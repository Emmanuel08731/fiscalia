require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware Esencial
app.use(express.json());
app.use(cors());

// --- SOLUCIÓN AL ERROR "Cannot GET /" ---
// 1. Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// 2. Ruta principal: Carga el login automáticamente
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- LÓGICA DE BASE DE DATOS (Mantenida) ---
const bootstrap = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nombre TEXT,
                apellido TEXT,
                cedula TEXT UNIQUE,
                password TEXT,
                rango TEXT DEFAULT 'Ciudadano',
                edad INTEGER,
                sangre TEXT,
                nacionalidad TEXT DEFAULT 'Colombiana'
            );
        `);
        console.log("🏛️  SPOA: Sistema de archivos y DB listos.");
    } catch (e) { console.error("Error inicializando DB:", e); }
};
bootstrap();

// --- RUTAS DE API ---
app.post('/api/auth', async (req, res) => {
    const { action, nombre, apellido, cedula, password, edad, sangre, adminCode } = req.body;
    try {
        if (action === 'register') {
            const hash = await bcrypt.hash(password, 10);
            const rango = (adminCode === 'EMMA2026') ? 'Admin' : 'Ciudadano';
            await pool.query(
                `INSERT INTO usuarios (nombre, apellido, cedula, password, rango, edad, sangre) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [nombre, apellido, cedula, hash, rango, edad, sangre]
            );
            return res.json({ success: true });
        }
        if (action === 'login') {
            const result = await pool.query('SELECT * FROM usuarios WHERE cedula = $1', [cedula]);
            if (result.rows.length > 0) {
                const user = result.rows[0];
                if (await bcrypt.compare(password, user.password)) {
                    return res.json({ success: true, user });
                }
            }
            return res.status(401).json({ success: false, error: "Credenciales Incorrectas" });
        }
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
