// --- server.js (Versión Blindada para Render) ---
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de la Conexión
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Obligatorio para Render/Neon/Supabase
});

/**
 * MOTOR DE REESTRUCTURACIÓN JUDICIAL v4.0
 * Este bloque limpia la base de datos de cualquier error previo
 * de columnas como tipo_sangre, edad, etc.
 */
const inicializarSPOA = async () => {
    console.log("-----------------------------------------");
    console.log("🏛️  SISTEMA DE INFORMACIÓN JUDICIAL (SPOA)");
    console.log("-----------------------------------------");
    
    try {
        // 1. Verificamos si la tabla tiene errores estructurales
        // Si quieres BORRAR TODO y empezar de cero para arreglar la DB, activa la línea de abajo:
        // await pool.query('DROP TABLE IF EXISTS denuncias, buscados, usuarios CASCADE;');

        // 2. Creación de Tabla de Ciudadanos con TODO incluido
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                apellido VARCHAR(100) NOT NULL,
                cedula VARCHAR(20) UNIQUE NOT NULL,
                password TEXT NOT NULL,
                edad INTEGER DEFAULT 18,
                nacionalidad VARCHAR(50) DEFAULT 'Colombiana',
                tipo_sangre VARCHAR(5) DEFAULT 'O+',
                rango VARCHAR(20) DEFAULT 'Ciudadano',
                fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 3. Tabla de Procesos Judiciales
        await pool.query(`
            CREATE TABLE IF NOT EXISTS denuncias (
                id SERIAL PRIMARY KEY,
                asunto TEXT NOT NULL,
                detalle TEXT NOT NULL,
                id_denunciante INTEGER REFERENCES usuarios(id),
                cedula_acusado VARCHAR(20) NOT NULL,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. Asegurar Cuenta de Emma (Admin)
        const salt = await bcrypt.genSalt(10);
        const passEmma = await bcrypt.hash('emmanuel2013', salt);
        
        await pool.query(`
            INSERT INTO usuarios (nombre, apellido, cedula, password, rango)
            VALUES ('Emmanuel', 'Fiscal General', 'emma062013', $1, 'Admin')
            ON CONFLICT (cedula) DO NOTHING;
        `, [passEmma]);

        console.log("✅ Base de Datos Sincronizada Correctamente.");
    } catch (err) {
        console.error("❌ Error Crítico en DB:", err.stack);
    }
};

inicializarSPOA();

// --- ENDPOINTS DE ALTA SEGURIDAD ---

app.post('/api/auth/handler', async (req, res) => {
    const { action, nombre, apellido, cedula, password, edad, nacionalidad, sangre } = req.body;
    try {
        if (action === 'register') {
            const hash = await bcrypt.hash(password, 10);
            await pool.query(
                `INSERT INTO usuarios (nombre, apellido, cedula, password, edad, nacionalidad, tipo_sangre) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [nombre, apellido, cedula, hash, edad || 18, nacionalidad || 'Colombiana', sangre || 'O+']
            );
            return res.json({ success: true, message: "Registro civil completado" });
        }

        if (action === 'login') {
            const userRes = await pool.query('SELECT * FROM usuarios WHERE cedula = $1', [cedula]);
            if (userRes.rows.length > 0) {
                const match = await bcrypt.compare(password, userRes.rows[0].password);
                if (match) return res.json({ success: true, user: userRes.rows[0] });
            }
            return res.status(401).json({ success: false, error: "Cédula o Clave incorrecta" });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: "Error en el servidor judicial" });
    }
});

// Ruta para obtener la ficha judicial completa
app.get('/api/judicial/ficha/:id', async (req, res) => {
    try {
        const user = await pool.query('SELECT * FROM usuarios WHERE id = $1', [req.params.id]);
        const procesos = await pool.query('SELECT * FROM denuncias WHERE cedula_acusado = $1', [user.rows[0].cedula]);
        res.json({ ciudadano: user.rows[0], historial: procesos.rows });
    } catch (e) {
        res.status(500).json({ error: "No se pudo obtener la ficha" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 SPOA Online en puerto ${PORT}`);
});
