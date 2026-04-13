/**
 * *****************************************************************************
 * DARKCORD STUDIO - SISTEMA OPERATIVO MÓVIL (BACKEND)
 * *****************************************************************************
 * Descripción: Gestión de base de datos PostgreSQL en Render con soporte
 * para múltiples idiomas y validaciones de identidad ciudadana.
 * *****************************************************************************
 */

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Middlewares Pro
app.use(express.json());
app.use(cors());
app.use(morgan('combined')); // Logs detallados de cada petición
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de Conexión a Base de Datos (Render)
const pool = new Pool({
    connectionString: "postgresql://base_de_datos_ci70_user:V9zztzVkPDXBfNraRmH85ubSt6YFOHWq@dpg-d7e3021j2pic73fvejd0-a.virginia-postgres.render.com/base_de_datos_ci70",
    ssl: { rejectUnauthorized: false }
});

/**
 * INICIALIZACIÓN DE LA INFRAESTRUCTURA
 * Asegura que la tabla de ciudadanos esté configurada correctamente.
 */
const bootDatabase = async () => {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR(100) NOT NULL,
            apellido VARCHAR(100) NOT NULL,
            edad INTEGER NOT NULL,
            nacionalidad VARCHAR(100) NOT NULL,
            tipo_sangre VARCHAR(20) NOT NULL,
            usuario VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            discord_user VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;
    
    try {
        const client = await pool.connect();
        console.log("-----------------------------------------");
        console.log("📡 DATABASE: CONEXIÓN ESTABLECIDA");
        await client.query(createTableSQL);
        console.log("✅ ESTRUCTURA DE TABLAS: OK");
        console.log("-----------------------------------------");
        client.release();
    } catch (err) {
        console.error("❌ CRITICAL ERROR DB:", err.message);
    }
};

bootDatabase();

// --- ENDPOINTS DE AUTENTICACIÓN ---

/**
 * POST /auth/register
 * Registra un nuevo ciudadano con validación de duplicados.
 */
app.post('/auth/register', async (req, res) => {
    const { 
        nombre, apellido, edad, nacionalidad, 
        tipo_sangre, usuario, password, discord_user 
    } = req.body;

    // Validación estricta en el servidor
    if (!nombre || !apellido || !edad || !nacionalidad || !tipo_sangre || !usuario || !password) {
        return res.status(400).json({ 
            success: false, 
            error: "Missing mandatory fields" 
        });
    }

    try {
        const query = `
            INSERT INTO usuarios (nombre, apellido, edad, nacionalidad, tipo_sangre, usuario, password, discord_user)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id;
        `;
        const values = [nombre, apellido, edad, nacionalidad, tipo_sangre, usuario, password, discord_user || 'None'];
        const result = await pool.query(query, values);
        
        console.log(`👤 Ciudadano Registrado: ${usuario} (ID: ${result.rows[0].id})`);
        res.status(201).json({ success: true, id: result.rows[0].id });
    } catch (err) {
        if (err.code === '23505') {
            res.status(409).json({ success: false, error: "Username already exists" });
        } else {
            res.status(500).json({ success: false, error: "Database internal error" });
        }
    }
});

/**
 * POST /auth/login
 * Verifica credenciales para acceso al Dashboard.
 */
app.post('/auth/login', async (req, res) => {
    const { usuario, password } = req.body;

    try {
        const query = 'SELECT * FROM usuarios WHERE usuario = $1 AND password = $2';
        const result = await pool.query(query, [usuario, password]);

        if (result.rows.length > 0) {
            const user = result.rows[0];
            delete user.password; // Ocultar contraseña por seguridad
            res.json({ success: true, user });
        } else {
            res.status(401).json({ success: false, error: "Invalid credentials" });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: "Server error" });
    }
});

// Inicio de Servidor
app.listen(PORT, () => {
    console.log(`
    =========================================
    📱 DARKCORD OS - SERVER RUNNING
    🌍 URL: http://localhost:${PORT}
    🛠️  MODE: PRO MAX PRODUCTION
    =========================================
    `);
});