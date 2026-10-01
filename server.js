const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
const dbFile = path.join(__dirname, 'ajuptel.db');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) console.error('Error al conectar con la base de datos:', err.message);
    else console.log('Conectado a la base de datos SQLite.');
});

// Crear tabla asegurando columnas JSON
db.run(`CREATE TABLE IF NOT EXISTS inscripciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombres TEXT,
    apellidos TEXT,
    cedula TEXT UNIQUE,
    p00 TEXT,
    fecha_nacimiento TEXT,
    direccion TEXT,
    telefono_hab TEXT,
    telefono_cel TEXT,
    telefono_alt TEXT,
    correo TEXT,
    correo_alt TEXT,
    ascendientes_json TEXT,
    descendientes_json TEXT,
    contacto_alt TEXT,
    status_social TEXT,
    discapacidad TEXT,
    detalle_discapacidad TEXT
)`, (err) => {
    if (!err) {
        db.run(`ALTER TABLE inscripciones ADD COLUMN ascendientes_json TEXT`, () => {});
        db.run(`ALTER TABLE inscripciones ADD COLUMN descendientes_json TEXT`, () => {});
    }
});

// Rutas API CRUD
app.get('/api/registros', (req, res) => {
    db.all(`SELECT * FROM inscripciones ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/registros/:id', (req, res) => {
    db.get(`SELECT * FROM inscripciones WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'No encontrado' });
        res.json(row);
    });
});

app.post('/api/registros', (req, res) => {
    const d = req.body;
    const query = `INSERT INTO inscripciones (
        nombres, apellidos, cedula, p00, fecha_nacimiento, direccion, 
        telefono_hab, telefono_cel, telefono_alt, correo, correo_alt, 
        ascendientes_json, descendientes_json, contacto_alt, status_social, discapacidad, detalle_discapacidad
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
        d.nombres, d.apellidos, d.cedula, d.p00, d.fecha_nacimiento, d.direccion,
        d.telefono_hab, d.telefono_cel, d.telefono_alt, d.correo, d.correo_alt,
        d.ascendientes_json, d.descendientes_json, d.contacto_alt, d.status_social, d.discapacidad, d.detalle_discapacidad
    ];

    db.run(query, params, function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ id: this.lastID, message: 'Creado con éxito' });
    });
});

app.put('/api/registros/:id', (req, res) => {
    const d = req.body;
    const query = `UPDATE inscripciones SET 
        nombres=?, apellidos=?, cedula=?, p00=?, fecha_nacimiento=?, direccion=?, 
        telefono_hab=?, telefono_cel=?, telefono_alt=?, correo=?, correo_alt=?, 
        ascendientes_json=?, descendientes_json=?, contacto_alt=?, status_social=?, discapacidad=?, detalle_discapacidad=? 
        WHERE id=?`;

    const params = [
        d.nombres, d.apellidos, d.cedula, d.p00, d.fecha_nacimiento, d.direccion,
        d.telefono_hab, d.telefono_cel, d.telefono_alt, d.correo, d.correo_alt,
        d.ascendientes_json, d.descendientes_json, d.contacto_alt, d.status_social, d.discapacidad, d.detalle_discapacidad, req.params.id
    ];

    db.run(query, params, function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: 'Actualizado con éxito' });
    });
});

app.delete('/api/registros/:id', (req, res) => {
    db.run(`DELETE FROM inscripciones WHERE id = ?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Eliminado con éxito' });
    });
});

// Ruta PDF
app.get('/api/registros/:id/pdf', (req, res) => {
    db.get(`SELECT * FROM inscripciones WHERE id = ?`, [req.params.id], (err, item) => {
        if (err || !item) return res.status(404).send('Registro no encontrado');

        const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Inscripcion_${item.cedula}.pdf`);
        doc.pipe(res);

        // Marca de agua
        doc.save();
        doc.opacity(0.08);
        doc.font('Helvetica-Bold').fontSize(32);
        doc.translate(306, 396);
        doc.rotate(-45);
        doc.text('INFORMACIÓN CONFIDENCIAL', -250, -20, { align: 'center', width: 500 });
        doc.restore();

       // Logo seguro con depuración
        const logoPath = path.join(__dirname, 'public', 'logo.jpg');
        console.log('Ruta absoluta buscada para el logo:', logoPath);
        console.log('¿El archivo existe físicamente?:', fs.existsSync(logoPath));

        if (fs.existsSync(logoPath)) {
        try {
        doc.image(logoPath, 40, 20, { width: 45 });
        console.log('¡Logo insertado correctamente en el PDF!');
        } catch (e) {
        console.error('Error al intentar renderizar la imagen en el PDF:', e.message);
        }
        } else {
        console.error('¡ATENCIÓN: El archivo de imagen no se encontró en la ruta especificada!');
        }

        // Encabezado
        doc.fontSize(9).font('Helvetica-Bold').text('ASOCIACIÓN DE JUBILADOS Y PENSIONADOS DE TELECOMUNICACIONES', 95, 22, { align: 'center', width: 440 });
        doc.fontSize(10).text('AJUPTEL CARABOBO', { align: 'center', width: 440 });
        doc.fontSize(7).font('Helvetica').text('PLANILLA DE INSCRIPCIÓN Y ACTUALIZACIÓN DE DATOS', { align: 'center', width: 440 });

        doc.moveDown(0.5);
        doc.fontSize(6.5).font('Helvetica-Bold').text('( ACEPTO LA INSCRIPCION EN AJUPTEL CARABOBO Y AUTORIZANDO EL DESCUENTO DE MI CUENTA NÓMINA CANTV )', { align: 'center' });
        
        function drawField(label, value, yPos) {
            doc.fontSize(8).font('Helvetica-Bold').text(label + ':', 40, yPos, { width: 110 });
            doc.font('Helvetica').text(value || '', 155, yPos, { width: 415 });
            doc.moveTo(40, yPos + 10).lineTo(572, yPos + 10).strokeColor('#777777').lineWidth(0.3).stroke();
        }

        let y = 105;
        const gap = 16;

        drawField('NOMBRES', item.nombres, y); y += gap;
        drawField('APELLIDOS', item.apellidos, y); y += gap;
        drawField('CÉDULA', item.cedula, y); y += gap;
        drawField('P00', item.p00, y); y += gap;
        drawField('FECHA NACIMIENTO', item.fecha_nacimiento, y); y += gap;
        drawField('DIRECCIÓN', item.direccion, y); y += gap;
        drawField('TLF HABITACIÓN', item.telefono_hab, y); y += gap;
        drawField('TLF CELULAR', item.telefono_cel, y); y += gap;
        drawField('TLF ALTERNATIVO', item.telefono_alt, y); y += gap;
        drawField('CORREO', item.correo, y); y += gap;
        drawField('CORREO ALT.', item.correo_alt, y); y += gap;
        
        try {
            const ascList = JSON.parse(item.ascendientes_json || '[]');
            if (ascList.length > 0) {
                doc.fontSize(8).font('Helvetica-Bold').text('ASCENDIENTES:', 40, y);
                y += 12;
                ascList.forEach((fam) => {
                    doc.font('Helvetica').text(`- ${fam.parentesco}: ${fam.nombresApellidos} (C.I: ${fam.cedula})`, 45, y, { width: 520 });
                    y += 14;
                });
            }
        } catch (e) {}

        try {
            const descList = JSON.parse(item.descendientes_json || '[]');
            if (descList.length > 0) {
                doc.fontSize(8).font('Helvetica-Bold').text('DESCENDIENTES:', 40, y);
                y += 12;
                descList.forEach((fam) => {
                    doc.font('Helvetica').text(`- ${fam.parentesco}: ${fam.nombresApellidos} (C.I: ${fam.cedula})`, 45, y, { width: 520 });
                    y += 14;
                });
            }
        } catch (e) {}

        drawField('CONTACTO ALT.', item.contacto_alt, y); y += gap;

        doc.fontSize(8).font('Helvetica-Bold').text('STATUS SOCIAL:', 40, y);
        const est = item.status_social;
        doc.font('Helvetica').text(`[ ${est === 'Estable' ? 'X' : ' '} ] ESTABLE    [ ${est === 'Precario' ? 'X' : ' '} ] PRECARIO    [ ${est === 'En Abandono' ? 'X' : ' '} ] EN ABANDONO`, 155, y);
        y += gap;

        doc.font('Helvetica-Bold').text('DISCAPACIDAD:', 40, y);
        const disp = item.discapacidad;
        doc.font('Helvetica').text(`[ ${disp === 'No posee' ? 'X' : ' '} ] NO POSEE    [ ${disp === 'Sí posee' ? 'X' : ' '} ] SI POSEE  =>  ¿CUAL?: ${item.detalle_discapacidad || ''}`, 155, y);
        y += 35;

        doc.fontSize(8);
        doc.text('____________________________________', 60, y);
        doc.text('____________________________________', 330, y);
        y += 10;
        doc.font('Helvetica-Bold').text('FIRMA DEL JUBILADO', 95, y);
        doc.font('Helvetica-Bold').text('FIRMA Y SELLO DE AJUPTEL CARABOBO', 340, y);

        doc.end();
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});