"""Vercel Python entry point — routes all /api/* requests to the FastAPI app."""

from backend.app.main import app

handler = app
