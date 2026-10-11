import pandas as pd
import numpy as np
import random
from collections import defaultdict, deque
import ast

# =============================================================================
# PARAMETER
# =============================================================================
SCENARIO = "Senario_A"
NUM_RECLOSERS = 4  
COLONY_SIZE = 100
MAX_ITERATIONS = 30


# =============================================================================
# PROGRAM UTAMA 
# =============================================================================

class RecloserOptimizer:
    def __init__(self, df, num_reclosers=NUM_RECLOSERS):
        # Set random seed untuk reproducibility
        random.seed(RANDOM_SEED)
        np.random.seed(RANDOM_SEED)
        
        self.df = df.copy().reset_index(drop=True)
        self.num_reclosers = num_reclosers
        
        # Hitung total customers (jumlahkan semua num_customers)
        self.total_customers = float(self.df['num_customers'].sum())
        
        # Bangun struktur jaringan (adaptasi dari program referensi)
        self.line_info = self.build_line_info()
        
        # Precompute downstream line untuk setiap line
        self.downstream_lines_cache = {}
        for line_id in self.line_info.keys():
            self.downstream_lines_cache[line_id] = self.get_all_downstream_line_ids(line_id)
        
        # Cari kandidat (semua line)
        self.candidates = self.find_candidates()
        
        # Pre-calculate baseline SAIDI dan SAIFI (tanpa recloser)
        self.baseline_saidi, self.baseline_saifi = self.calculate_saidi_saifi([])
        
        # Total System Risk (Σ pola_gangguan)
        self.total_system_risk = sum(self.df['pola_gangguan'].values)
        
        print(f"{'='*60}")
        print(f"📊 INISIALISASI OPTIMIZER")
        print(f"{'='*60}")
        print(f"   Total Customers: {self.total_customers:,.0f}")
        print(f"   Total System Risk (Σ pola_gangguan): {self.total_system_risk:.4f}")
        print(f"   Baseline SAIDI: {self.baseline_saidi:.4f} jam/pelanggan/tahun")
        print(f"   Baseline SAIFI: {self.baseline_saifi:.4f} gangguan/pelanggan/tahun")
        print(f"   Jumlah Kandidat: {len(self.candidates)} line")
        print(f"{'='*60}")

    # =========================================================================
    # MEMBANGUN STRUKTUR JARINGAN (ADAPTASI DARI PROGRAM REFERENSI)
    # =========================================================================
    
    def build_line_info(self):
        """
        Membangun struktur jaringan berdasarkan data line
        Sama persis dengan program referensi
        """
        line_info = {}
        
        for _, row in self.df.iterrows():
            line_id = int(row['line_id'])
            from_bus = row['from_bus']
            to_bus = row['to_bus']
            lam = row['synthetic_lambda_yearly']
            duration = row['synthetic_outage_duration_yearly']
            customers = row['num_customers']
            downstream_cust = row['total_downstream_customers']
            
            # Handle downstream_buses
            downstream_buses = row['downstream_buses']
            if isinstance(downstream_buses, str):
                try:
                    downstream_buses = ast.literal_eval(downstream_buses)
                except:
                    downstream_buses = []
            elif downstream_buses is None or (isinstance(downstream_buses, float) and pd.isna(downstream_buses)):
                downstream_buses = []
            
            line_info[line_id] = {
                'from_bus': from_bus,
                'to_bus': to_bus,
                'lam': lam,
                'duration': duration,
                'customers': customers,
                'downstream_customers': downstream_cust,
                'downstream_buses': downstream_buses if isinstance(downstream_buses, list) else [],
                'pola_gangguan': row['pola_gangguan']
            }
        
        return line_info

    def get_all_downstream_line_ids(self, pemutus_line_id, visited=None):
        """
        Mendapatkan semua line yang berada di hilir pemutus_line_id
        Sama persis dengan program referensi
        """
        if visited is None:
            visited = set()
        
        if pemutus_line_id in visited:
            return []
        
        visited.add(pemutus_line_id)
        downstream_line_ids = [pemutus_line_id]
        
        # Dapatkan downstream_buses dari pemutus line
        pemutus_downstream_buses = self.line_info[pemutus_line_id]['downstream_buses']
        
        if not pemutus_downstream_buses or not isinstance(pemutus_downstream_buses, list):
            return downstream_line_ids
        
        # Cari line yang from_bus-nya ada di downstream_buses
        for fid, info in self.line_info.items():
            if fid in visited:
                continue
            if info['from_bus'] in pemutus_downstream_buses:
                sub_downstream = self.get_all_downstream_line_ids(fid, visited)
                for sub_fid in sub_downstream:
                    if sub_fid not in downstream_line_ids:
                        downstream_line_ids.append(sub_fid)
        
        return downstream_line_ids

    def get_all_upstream_line_ids(self, line_id):
        """
        Mendapatkan semua line yang berada di hulu line_id
        (line yang memiliki line_id di downstream_buses-nya)
        """
        upstream_lines = []
        for fid, info in self.line_info.items():
            downstream = self.get_all_downstream_line_ids(fid)
            if line_id in downstream and fid != line_id:
                upstream_lines.append(fid)
        return upstream_lines

    # =========================================================================
    # PERHITUNGAN SAIDI DAN SAIFI UNTUK MULTIPLE RECLOSER
    # =========================================================================
    
    def calculate_saidi_saifi(self, recloser_positions):
        """
        Menghitung SAIFI dan SAIDI untuk konfigurasi multiple recloser
        
        Logika:
        - Setiap line akan dilindungi oleh recloser yang PALING DEKAT (paling upstream)
        - line yang tidak memiliki recloser di upstream-nya akan terdampak seluruh sistem
        - line yang memiliki recloser di upstream-nya hanya terdampak downstream_customers-nya
        
        Parameters:
        recloser_positions: list of string, e.g., ['line_35', 'line_50']
        """
        
        if not recloser_positions:
            # Baseline: semua line terdampak total_customers
            sum_lambda_N = 0
            sum_lambda_dur_N = 0
            for fid, info in self.line_info.items():
                lam = info['lam']
                duration = info['duration']
                sum_lambda_N += lam * self.total_customers
                sum_lambda_dur_N += lam * duration * self.total_customers
            
            saifi = sum_lambda_N / self.total_customers
            saidi = sum_lambda_dur_N / self.total_customers
            return saidi, saifi
        
        # Konversi recloser_positions ke integer
        recloser_ids = [int(r.split('_')[1]) for r in recloser_positions]
        
        # Untuk setiap line, tentukan recloser mana yang melindunginya (yang paling upstream)
        line_protection = {}  # line_id -> (recloser_id, downstream_customers)
        
        for recloser_id in recloser_ids:
            downstream_lines = self.get_all_downstream_line_ids(recloser_id)
            downstream_customers = self.line_info[recloser_id]['downstream_customers']
            
            for fid in downstream_lines:
                # Jika line belum memiliki pelindung, atau recloser ini lebih upstream
                if fid not in line_protection:
                    line_protection[fid] = (recloser_id, downstream_customers)
                else:
                    # Cek apakah recloser ini lebih upstream dari yang sudah ada
                    existing_recloser = line_protection[fid][0]
                    # Recloser yang lebih upstream memiliki downstream_customers lebih besar
                    if downstream_customers > line_protection[fid][1]:
                        line_protection[fid] = (recloser_id, downstream_customers)
        
        # Hitung SAIDI dan SAIFI
        sum_lambda_N = 0
        sum_lambda_dur_N = 0
        
        for fid, info in self.line_info.items():
            lam = info['lam']
            duration = info['duration']
            
            if fid in line_protection:
                # line ini dilindungi oleh recloser
                _, downstream_cust = line_protection[fid]
                N_aff = downstream_cust
            else:
                # line ini tidak dilindungi recloser manapun
                N_aff = self.total_customers
            
            sum_lambda_N += lam * N_aff
            sum_lambda_dur_N += lam * duration * N_aff
        
        saifi = sum_lambda_N / self.total_customers
        saidi = sum_lambda_dur_N / self.total_customers
        
        return saidi, saifi

    # =========================================================================
    # FUNGSI UNTUK MENENTUKAN ZONA PROTEKSI (UNTUK RISK PENALTY)
    # =========================================================================
    
    def get_protected_lines(self, recloser_positions):
        """
        Mendapatkan semua line yang dilindungi oleh recloser
        (line yang berada di downstream dari minimal 1 recloser)
        """
        protected_lines = set()
        
        for recloser in recloser_positions:
            line_num = int(recloser.split('_')[1])
            downstream_lines = self.get_all_downstream_line_ids(line_num)
            protected_lines.update(downstream_lines)
        
        return protected_lines

    def calculate_risk_penalty(self, recloser_positions, verbose=False):
        """
        Menghitung risk penalty berdasarkan ZONA PERLINDUNGAN.
        Rumus: Risk = Σ pola_gangguan yang TIDAK terproteksi
        """
        all_protected_lines = self.get_protected_lines(recloser_positions)
        
        total_unprotected_risk = 0.0
        unprotected_lines = []
        
        for line_id, info in self.line_info.items():
            if line_id not in all_protected_lines:
                total_unprotected_risk += info['pola_gangguan']
                unprotected_lines.append({
                    'line_id': line_id,
                    'pola_gangguan': info['pola_gangguan'],
                    'customers': info['customers']
                })
        
        
        return total_unprotected_risk

    # =========================================================================
    # FUNGSI UNTUK KANDIDAT DAN CONSTRAINTS
    # =========================================================================
    
    def find_candidates(self):
        """Ambil SEMUA line sebagai kandidat"""
        candidate_list = [f"line_{line_id}" for line_id in self.line_info.keys()]
        return candidate_list

    def get_zone_customers(self, recloser_line):
        """Hitung jumlah pelanggan dalam zona proteksi satu recloser"""
        line_num = int(recloser_line.split('_')[1])
        protected_lines = self.get_all_downstream_line_ids(line_num)
        zone_customers = sum(self.line_info[fid]['customers'] for fid in protected_lines)
        return zone_customers

    def get_zone_risk(self, recloser_line):
        """Hitung total risk (Σ pola_gangguan) dalam zona proteksi satu recloser"""
        line_num = int(recloser_line.split('_')[1])
        protected_lines = self.get_all_downstream_line_ids(line_num)
        zone_risk = sum(self.line_info[fid]['pola_gangguan'] for fid in protected_lines)
        return zone_risk

    def get_unique_coverage_score(self, solution, candidate):
        """Hitung seberapa banyak candidate ini menambah coverage UNIK"""
        current_protected = self.get_protected_lines(solution)
        new_protected = self.get_protected_lines(solution + [candidate])
        new_coverage = new_protected - current_protected
        
        unique_risk_coverage = sum(self.line_info[fid]['pola_gangguan'] for fid in new_coverage)
        return unique_risk_coverage

    def calculate_constraint_penalties(self, recloser_positions):
        """Hitung penalti untuk constraint violation"""
        total_penalty = 0.0
        
        # 1. Penalti untuk recloser yang overlap zonanya
        if self.num_reclosers > 1:
            for i in range(len(recloser_positions)):
                for j in range(i + 1, len(recloser_positions)):
                    line_i = int(recloser_positions[i].split('_')[1])
                    line_j = int(recloser_positions[j].split('_')[1])
                    
                    protected_by_i = set(self.get_all_downstream_line_ids(line_i))
                    protected_by_j = set(self.get_all_downstream_line_ids(line_j))
                    
                    overlap = protected_by_i.intersection(protected_by_j)
                    if overlap:
                        smaller_zone = min(len(protected_by_i), len(protected_by_j))
                        overlap_fraction = len(overlap) / smaller_zone if smaller_zone > 0 else 0
                        
                        if overlap_fraction > MAX_ZONE_OVERLAP:
                            overlap_penalty = PENALTY_PROXIMITY_COEF * overlap_fraction * 100
                            total_penalty += overlap_penalty
        
        # 2. Penalti untuk zona proteksi terlalu besar
        for recloser in recloser_positions:
            zone_customers = self.get_zone_customers(recloser)
            zone_fraction = zone_customers / (self.total_customers + 1e-12)
            
            if zone_fraction > MAX_PROTECTED_FRACTION:
                excess_fraction = zone_fraction - MAX_PROTECTED_FRACTION
                zone_penalty = PENALTY_ZONE_SIZE_COEF * excess_fraction * 1000
                total_penalty += zone_penalty
        
        return total_penalty

    # =========================================================================
    # FUNGSI FITNESS DAN OPTIMASI
    # =========================================================================
    
    def calculate_fitness(self, recloser_positions):
        """
        Hitung fitness dengan NORMALISASI metrik
        Semakin kecil fitness, semakin baik
        """
        # 1. Hitung SAIDI dan SAIFI
        saidi_optimal, saifi_optimal = self.calculate_saidi_saifi(recloser_positions)
        
        # 2. Hitung Risk Penalty (Σ pola_gangguan yang TIDAK terlindungi)
        risk_penalty = self.calculate_risk_penalty(recloser_positions, verbose=False)
        
        # 3. Hitung constraint penalties
        constraint_penalty = self.calculate_constraint_penalties(recloser_positions)
        
        # Normalisasi metrik relatif terhadap baseline
        norm_saidi = saidi_optimal / (self.baseline_saidi + 1e-12)
        norm_saifi = saifi_optimal / (self.baseline_saifi + 1e-12)
        norm_risk = (risk_penalty /((self.total_system_risk + 1e-12) * RISK_SCALE))


        # Fitness function
        fitness = (W_SAIDI * norm_saidi + 
                   W_SAIFI * norm_saifi + 
                   W_RISK * norm_risk )
        
        return fitness

    def initialize_population(self):
        """Inisialisasi populasi"""
        population = []
        
        for _ in range(COLONY_SIZE):
            if self.num_reclosers == 1:
                solution = [random.choice(self.candidates)]
            else:
                # Pilih random tanpa duplikat
                solution = random.sample(self.candidates, min(self.num_reclosers, len(self.candidates)))
            population.append(solution)
        
        return population

    def generate_neighbor(self, solution):
        """Generate neighbor solution"""
        new_solution = solution.copy()
        
        if self.num_reclosers == 1:
            # Ganti dengan kandidat lain
            current = new_solution[0]
            others = [c for c in self.candidates if c != current]
            if others:
                new_solution[0] = random.choice(others)
        else:
            # Ganti satu posisi dengan kandidat yang tidak ada di solusi
            idx = random.randint(0, len(new_solution) - 1)
            current = new_solution[idx]
            available = [c for c in self.candidates if c not in new_solution]
            if available:
                new_solution[idx] = random.choice(available)
            else:
                # Jika semua kandidat sudah terpakai, ganti dengan random
                new_solution[idx] = random.choice(self.candidates)
        
        return new_solution

    def optimize(self):
        """Algoritma ABC Optimization"""
        population = self.initialize_population()
        fitnesses = [self.calculate_fitness(sol) for sol in population]
        trials = [0] * COLONY_SIZE
        limit = COLONY_SIZE * self.num_reclosers
        
        best_idx = int(np.argmin(fitnesses))
        best_solution = population[best_idx]
        best_fitness = fitnesses[best_idx]
        
        print(f"🚀 Memulai optimasi {self.num_reclosers} recloser...")
        print(f"{'Iter':<5} {'Fitness':<12} {'SAIDI':<14} {'SAIFI':<14} {'Solusi'}")
        print("-" * 70)
        
        fitness_cache = {}
        
        for iteration in range(MAX_ITERATIONS):
            # Employed Bee Phase
            for i in range(COLONY_SIZE):
                neighbor = self.generate_neighbor(population[i])
                neighbor_tuple = tuple(sorted(neighbor))
                
                if neighbor_tuple in fitness_cache:
                    neighbor_fitness = fitness_cache[neighbor_tuple]
                else:
                    neighbor_fitness = self.calculate_fitness(neighbor)
                    fitness_cache[neighbor_tuple] = neighbor_fitness
                
                if neighbor_fitness < fitnesses[i]:
                    population[i] = neighbor
                    fitnesses[i] = neighbor_fitness
                    trials[i] = 0
                else:
                    trials[i] += 1
            
            # Onlooker Bee Phase
            max_fit = max(fitnesses)
            probs = [(max_fit - fit + 1e-10) for fit in fitnesses]
            total_prob = sum(probs)
            if total_prob > 0:
                probs = [p/total_prob for p in probs]
            else:
                probs = [1.0/COLONY_SIZE] * COLONY_SIZE
            
            for _ in range(COLONY_SIZE):
                idx = int(np.random.choice(COLONY_SIZE, p=probs))
                neighbor = self.generate_neighbor(population[idx])
                neighbor_tuple = tuple(sorted(neighbor))
                
                if neighbor_tuple in fitness_cache:
                    neighbor_fitness = fitness_cache[neighbor_tuple]
                else:
                    neighbor_fitness = self.calculate_fitness(neighbor)
                    fitness_cache[neighbor_tuple] = neighbor_fitness
                
                if neighbor_fitness < fitnesses[idx]:
                    population[idx] = neighbor
                    fitnesses[idx] = neighbor_fitness
                    trials[idx] = 0
                else:
                    trials[idx] += 1
            
            # Scout Bee Phase
            for i in range(COLONY_SIZE):
                if trials[i] >= limit:
                    if self.num_reclosers == 1:
                        new_sol = [random.choice(self.candidates)]
                    else:
                        new_sol = random.sample(self.candidates, min(self.num_reclosers, len(self.candidates)))
                    
                    population[i] = new_sol
                    fitnesses[i] = self.calculate_fitness(new_sol)
                    trials[i] = 0
            
            # Update terbaik
            current_best_idx = int(np.argmin(fitnesses))
            if fitnesses[current_best_idx] < best_fitness:
                best_solution = population[current_best_idx]
                best_fitness = fitnesses[current_best_idx]
            
            # Tampilkan progress
            if (iteration + 1) % 1 == 0 or iteration == MAX_ITERATIONS - 1:
                best_saidi, best_saifi = self.calculate_saidi_saifi(best_solution)
                sol_str = ", ".join(best_solution)
                print(f"{iteration+1:<5} {best_fitness:<12.4f} {best_saidi:<14.4f} {best_saifi:<14.4f} {sol_str}")
        
        return best_solution, best_fitness


# =============================================================================
# FUNGSI BANTU DAN MAIN EXECUTION
# =============================================================================

def load_data_from_csv():
    """Load data dari file CSV"""
    try:
        df = pd.read_csv('hasil_prediksi_gangguan_final_a.csv')
        
        # Konversi kolom downstream_buses dari string ke list jika perlu
        if 'downstream_buses' in df.columns:
            first_val = df['downstream_buses'].iloc[0]
            if isinstance(first_val, str):
                df['downstream_buses'] = df['downstream_buses'].apply(ast.literal_eval)
        
        print(f"✓ Data berhasil dimuat: {len(df)} segmen")
        return df
        
    except FileNotFoundError:
        print("❌ File 'hasil_prediksi_gangguan_final_a.csv' tidak ditemukan")
        exit()
    except Exception as e:
        print(f"❌ Error loading data: {e}")
        exit()

# BOBOT sesuai permintaan Anda
W_SAIDI, W_SAIFI, W_RISK = 0.3, 0.3, 0.4

# Parameter penalti
MAX_PROTECTED_FRACTION = 0.65      # Maksimum fraksi pelanggan dalam satu zona proteksi
MIN_DISTANCE_LEVELS = 0             # Minimal selisih level antara recloser
MAX_ZONE_OVERLAP = 0.2              # Maksimal overlap zona yang diperbolehkan (20%)

PENALTY_PROXIMITY_COEF = 8.0        # Koefisien penalti untuk recloser berdekatan
PENALTY_ZONE_SIZE_COEF = 3.0        # Koefisien penalti untuk zona proteksi terlalu besar
RISK_SCALE = 1000.0
# Reproducibility
RANDOM_SEED = 42

if __name__ == "__main__":
    print("=" * 60)
    print(f"🔧 OPTIMASI PENEMPATAN RECLOSER {SCENARIO}")
    print("=" * 60)
    
    try:
        # Load data
        df = load_data_from_csv()
        
        # Inisialisasi optimizer
        optimizer = RecloserOptimizer(df, NUM_RECLOSERS)
        
        # OPTIMASI dengan ABC
        solution, fitness = optimizer.optimize()
        
        # TAMPILKAN HASIL AKHIR
        print(f"{'='*60}")
        print(f"🏆 HASIL OPTIMASI {NUM_RECLOSERS} RECLOSER")
        print(f"{'='*60}")
        print(f"   Fitness terbaik: {fitness:.6f}")
        print(f"   Solusi optimal: {solution}")
        
        # Hitung dan tampilkan improvement
        optimal_saidi, optimal_saifi = optimizer.calculate_saidi_saifi(solution)
        
        baseline_saidi, baseline_saifi = optimizer.baseline_saidi, optimizer.baseline_saifi
        saidi_improvement = ((baseline_saidi - optimal_saidi) / baseline_saidi * 100) if baseline_saidi > 0 else 0
        saifi_improvement = ((baseline_saifi - optimal_saifi) / baseline_saifi * 100) if baseline_saifi > 0 else 0
        
        # Hitung risk yang tidak terproteksi
        unprotected_risk = optimizer.calculate_risk_penalty(solution, verbose=True)
        
        print(f"📈 PERBAIKAN DENGAN {NUM_RECLOSERS} RECLOSER:")
        print(f"   SAIDI: {baseline_saidi:.4f} → {optimal_saidi:.4f} ({saidi_improvement:+.1f}%)")
        print(f"   SAIFI: {baseline_saifi:.4f} → {optimal_saifi:.4f} ({saifi_improvement:+.1f}%)")
        print(f"   Risk Tidak Terproteksi: {unprotected_risk:.4f} / {optimizer.total_system_risk:.4f} ({unprotected_risk/optimizer.total_system_risk*100:.1f}%)")
        
        # Tampilkan detail zona proteksi
        print(f"\n📍 DETAIL ZONA PROTEKSI:")
        for i, line_name in enumerate(solution, 1):
            line_num = int(line_name.split('_')[1])
            zone_lines = optimizer.get_all_downstream_line_ids(line_num)
            
            zone_risk = sum(optimizer.line_info[fid]['pola_gangguan'] for fid in zone_lines)
            zone_customers = sum(optimizer.line_info[fid]['customers'] for fid in zone_lines)
            
            print(f"   {i}. {line_name}: {len(zone_lines)} line, {zone_customers:.0f} customers, risk={zone_risk:.4f}")
        
        
    except Exception as e:
        print(f"❌ Terjadi error: {e}")
        import traceback
        traceback.print_exc()