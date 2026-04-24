require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

const app = express();
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- MOTOR DE BASE DE DATOS INMORTAL ---
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
        console.log("🏛️  Esquema Judicial Sincronizado.");
    } catch (e) { console.error(e); }
};
bootstrap();

// --- LÓGICA DE AUTENTICACIÓN ---
app.post('/api/auth', async (req, res) => {
    const { action, nombre, apellido, cedula, password, edad, sangre, adminCode } = req.body;
    
    try {
        if (action === 'register') {
            const hash = await bcrypt.hash(password, 10);
            // CÓDIGO SECRETO PARA SER ADMIN: "EMMA2026"
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
            return res.status(401).json({ success: false, error: "Credenciales Inválidas" });
        }
    } catch (e) { res.status(400).json({ success: false, error: e.message }); }
});

app.listen(3000, () => console.log("🚀 Sistema Judicial v4.0 en Línea"));
