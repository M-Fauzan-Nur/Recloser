"""Vercel Python entry point.

When Root Directory = backend/, Vercel loads this file as the
@vercel/python function handler. Re-exports the FastAPI app from
app.main so all routes (/api/*) work.
"""
from app.main import app

handler = app
