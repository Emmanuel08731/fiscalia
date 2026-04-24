require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- MOTOR DE ESTRUCTURA JUDICIAL ---
const setupSPOA = async () => {
    console.log("🛠️  Sincronizando Sistema de Información Judicial...");
    try {
        // Creamos la tabla con todos los campos necesarios para el RP
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                apellido TEXT NOT NULL,
                cedula TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                edad INTEGER,
                nacionalidad TEXT DEFAULT 'Colombiana',
                tipo_sangre TEXT DEFAULT 'O+',
                telefono TEXT,
                rango TEXT DEFAULT 'Ciudadano',
                fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Tabla de Denuncias (SPOA)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS denuncias (
                id SERIAL PRIMARY KEY,
                asunto TEXT NOT NULL,
                detalle TEXT NOT NULL,
                id_denunciante INTEGER REFERENCES usuarios(id),
                cedula_acusado TEXT NOT NULL,
                estado TEXT DEFAULT 'En Indagación',
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Tabla de Orden de Captura
        await pool.query(`
            CREATE TABLE IF NOT EXISTS buscados (
                id SERIAL PRIMARY KEY,
                alias TEXT NOT NULL,
                delito TEXT NOT NULL,
                recompensa TEXT NOT NULL,
                nivel_peligrosidad TEXT DEFAULT 'Media'
            );
        `);

        // Configuración de Administrador Maestro (Emma)
        const emmaHash = await bcrypt.hash('emmanuel2013', 10);
        await pool.query(`
            INSERT INTO usuarios (nombre, apellido, cedula, password, rango)
            VALUES ('Emmanuel', 'Fiscalía', 'emma062013', $1, 'Admin')
            ON CONFLICT (cedula) DO NOTHING;
        `, [emmaHash]);

        console.log("🏛️  Base de Datos: SPOA v3.0 Conectada y Lista.");
    } catch (err) {
        console.error("⚠️ Error en DB. Intentando corrección de esquema...");
        // Si hay un error de columna, intentamos agregarla manualmente
        await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tipo_sangre TEXT DEFAULT 'O+';`);
        await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nacionalidad TEXT DEFAULT 'Colombiana';`);
    }
};
setupSPOA();

// --- RUTAS DE AUTENTICACIÓN ---

app.post('/api/auth/handler', async (req, res) => {
    const { action, nombre, apellido, cedula, password, edad, nacionalidad, sangre } = req.body;

    try {
        if (action === 'register') {
            const hash = await bcrypt.hash(password, 10);
            await pool.query(
                `INSERT INTO usuarios (nombre, apellido, cedula, password, edad, nacionalidad, tipo_sangre) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [nombre, apellido, cedula, hash, edad, nacionalidad, sangre]
            );
            return res.json({ success: true });
        }

        if (action === 'login') {
            const result = await pool.query('SELECT * FROM usuarios WHERE cedula = $1', [cedula]);
            if (result.rows.length > 0) {
                const user = result.rows[0];
                const match = await bcrypt.compare(password, user.password);
                if (match) return res.json({ success: true, user });
            }
            return res.status(401).json({ success: false, error: "Cédula o clave incorrecta" });
        }
    } catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});

// --- RUTAS DE DATOS ---

app.get('/api/perfil/:id', async (req, res) => {
    try {
        const user = await pool.query('SELECT * FROM usuarios WHERE id = $1', [req.params.id]);
        const judicial = await pool.query('SELECT * FROM denuncias WHERE cedula_acusado = $1', [user.rows[0].cedula]);
        res.json({ user: user.rows[0], procesos: judicial.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/buscados', async (req, res) => {
    const result = await pool.query('SELECT * FROM buscados');
    res.json(result.rows);
});

// --- ACCIONES ADMIN (EMMA) ---
app.post('/api/admin/orden-captura', async (req, res) => {
    const { alias, delito, recompensa } = req.body;
    await pool.query('INSERT INTO buscados (alias, delito, recompensa) VALUES ($1, $2, $3)', [alias, delito, recompensa]);
    res.json({ success: true });
});

app.listen(3000, () => console.log("🚀 Servidor Fiscalía Activo en Puerto 3000"));