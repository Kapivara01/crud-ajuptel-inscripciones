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

// Ruta principal para servir la interfaz desde la carpeta 'public'
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
        JSON.stringify(d.ascendientes || []), JSON.stringify(d.descendientes || []), 
        d.contacto_alt, d.status_social, d.discapacidad, d.detalle_discapacidad
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
        JSON.stringify(d.ascendientes || []), JSON.stringify(d.descendientes || []), 
        d.contacto_alt, d.status_social, d.discapacidad, d.detalle_discapacidad, req.params.id
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
// RUTA PDF: Generar Planilla en Blanco
app.get('/api/planilla-en-blanco/pdf', (req, res) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 45 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=Planilla_Inscripcion_Blanco.pdf');
    doc.pipe(res);

    doc.save();
    doc.opacity(0.05);
    doc.font('Helvetica-Bold').fontSize(40);
    doc.translate(306, 396);
    doc.rotate(-45);
    doc.text('DOCUMENTO EN BLANCO', -280, -25, { align: 'center', width: 560 });
    doc.restore();

    const logoPath = path.join(__dirname, 'public', 'logo.jpg');
    if (fs.existsSync(logoPath)) {
        try { doc.image(logoPath, 45, 30, { width: 95, height: 70 }); } catch (e) {}
    }

    doc.fontSize(11).font('Helvetica-Bold').text('ASOCIACIÓN DE JUBILADOS Y PENSIONADOS DE TELECOMUNICACIONES', 145, 38, { align: 'center', width: 390 });
    doc.fontSize(12).text('AJUPTEL CARABOBO', { align: 'center', width: 390 });
    doc.fontSize(8.5).font('Helvetica').text('PLANILLA DE INSCRIPCIÓN Y ACTUALIZACIÓN DE DATOS', { align: 'center', width: 390 });

    doc.moveDown(0.8);
    doc.fontSize(8).font('Helvetica-Bold').text('( ACEPTO LA INSCRIPCION EN AJUPTEL CARABOBO Y AUTORIZANDO EL DESCUENTO DE MI CUENTA NÓMINA CANTV )', { align: 'center' });
    doc.moveDown(1.5);

    function drawField(label) {
        const startY = doc.y;
        doc.fontSize(10).font('Helvetica-Bold').text(label + ':', 45, startY, { width: 165, lineBreak: false });
        const endY = Math.max(doc.y, startY + 12);
        doc.y = endY + 4;
        doc.moveTo(45, doc.y).lineTo(567, doc.y).strokeColor('#888888').lineWidth(0.5).stroke();
        doc.moveDown(0.7);
    }

    drawField('NOMBRES');
    drawField('APELLIDOS');
    drawField('CÉDULA');
    drawField('P00');
    drawField('FECHA NACIMIENTO');
    drawField('DIRECCIÓN');
    drawField('TLF HABITACIÓN');
    drawField('TLF CELULAR');
    drawField('TLF ALTERNATIVO');
    drawField('CORREO');
    drawField('CORREO ALT.');

    doc.moveDown(0.5);
    doc.fontSize(10.5).font('Helvetica-Bold').text('FAMILIARES ASCENDIENTES / DESCENDIENTES:', 45, doc.y);
    doc.moveDown(0.5);
    for(let i=0; i<3; i++) {
        drawField(`Familiar ${i+1} (Nombre / C.I / Parentesco)`);
    }

    drawField('CONTACTO ALT.');

    doc.moveDown(0.5);
    const statusY = doc.y;
    doc.fontSize(10.5).font('Helvetica-Bold').text('STATUS SOCIAL:', 45, statusY);
    doc.font('Helvetica').fontSize(10).text('[   ] ESTABLE     [   ] PRECARIO     [   ] EN ABANDONO', 190, statusY);
    doc.moveDown(1.5);

    const dispY = doc.y;
    doc.fontSize(10.5).font('Helvetica-Bold').text('DISCAPACIDAD:', 45, dispY);
    doc.font('Helvetica').fontSize(10).text('[   ] NO POSEE     [   ] SI POSEE  =>  ¿CUAL?: __________________________', 190, dispY);
    
    const signatureY = 700;
    doc.fontSize(9.5);
    doc.text('____________________________________', 60, signatureY);
    doc.text('____________________________________', 325, signatureY);
    
    doc.font('Helvetica-Bold').fontSize(9.5);
    doc.text('FIRMA DEL JUBILADO', 95, signatureY + 14);
    doc.text('FIRMA Y SELLO DE AJUPTEL CARABOBO', 335, signatureY + 14);

    doc.end();
});

// RUTA PDF: Registro Individual con Familiares
app.get('/api/registros/:id/pdf', (req, res) => {
    db.get(`SELECT * FROM inscripciones WHERE id = ?`, [req.params.id], (err, item) => {
        if (err || !item) return res.status(404).send('Registro no encontrado');

        const doc = new PDFDocument({ size: 'LETTER', margin: 45 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Inscripcion_${item.cedula}.pdf`);
        doc.pipe(res);

        doc.save();
        doc.opacity(0.07);
        doc.font('Helvetica-Bold').fontSize(40);
        doc.translate(306, 396);
        doc.rotate(-45);
        doc.text('INFORMACIÓN CONFIDENCIAL', -280, -25, { align: 'center', width: 560 });
        doc.restore();

        const logoPath = path.join(__dirname, 'public', 'logo.jpg');
        if (fs.existsSync(logoPath)) {
            try { doc.image(logoPath, 45, 30, { width: 95, height: 70 }); } catch (e) {}
        }

        doc.fontSize(11).font('Helvetica-Bold').text('ASOCIACIÓN DE JUBILADOS Y PENSIONADOS DE TELECOMUNICACIONES', 145, 38, { align: 'center', width: 390 });
        doc.fontSize(12).text('AJUPTEL CARABOBO', { align: 'center', width: 390 });
        doc.fontSize(8.5).font('Helvetica').text('PLANILLA DE INSCRIPCIÓN Y ACTUALIZACIÓN DE DATOS', { align: 'center', width: 390 });

        doc.moveDown(0.8);
        doc.fontSize(8).font('Helvetica-Bold').text('( ACEPTO LA INSCRIPCION EN AJUPTEL CARABOBO Y AUTORIZANDO EL DESCUENTO DE MI CUENTA NÓMINA CANTV )', { align: 'center' });
        doc.moveDown(1.5);

        function drawField(label, value) {
            const startY = doc.y;
            doc.fontSize(10).font('Helvetica-Bold').text(label + ':', 45, startY, { width: 165, lineBreak: false });
            doc.font('Helvetica').fontSize(10).text(value || '', 215, startY, { width: 350 });
            const endY = Math.max(doc.y, startY + 12);
            doc.y = endY + 4;
            doc.moveTo(45, doc.y).lineTo(567, doc.y).strokeColor('#888888').lineWidth(0.5).stroke();
            doc.moveDown(0.5);
        }

        drawField('NOMBRES', item.nombres);
        drawField('APELLIDOS', item.apellidos);
        drawField('CÉDULA', item.cedula);
        drawField('P00', item.p00);
        drawField('FECHA NACIMIENTO', item.fecha_nacimiento);
        drawField('DIRECCIÓN', item.direccion);
        drawField('TLF HABITACIÓN', item.telefono_hab);
        drawField('TLF CELULAR', item.telefono_cel);
        drawField('TLF ALTERNATIVO', item.telefono_alt);
        drawField('CORREO', item.correo);
        drawField('CORREO ALT.', item.correo_alt);
        
        doc.moveDown(0.3);

        try {
            const ascList = JSON.parse(item.ascendientes_json || '[]');
            if (ascList.length > 0) {
                doc.fontSize(10.5).font('Helvetica-Bold').text('ASCENDIENTES:', 45, doc.y);
                doc.moveDown(0.3);
                ascList.forEach((fam) => {
                    doc.font('Helvetica').fontSize(10).text(`- ${fam.parentesco || 'Familiar'}: ${fam.nombre || fam.nombresApellidos || ''} (C.I: ${fam.cedula || ''})`, 55, doc.y, { width: 500 });
                    doc.moveDown(0.4);
                });
                doc.moveDown(0.3);
            }
        } catch (e) {}

        try {
            const descList = JSON.parse(item.descendientes_json || '[]');
            if (descList.length > 0) {
                doc.fontSize(10.5).font('Helvetica-Bold').text('DESCENDIENTES:', 45, doc.y);
                doc.moveDown(0.3);
                descList.forEach((fam) => {
                    doc.font('Helvetica').fontSize(10).text(`- ${fam.parentesco || 'Familiar'}: ${fam.nombre || fam.nombresApellidos || ''} (C.I: ${fam.cedula || ''})`, 55, doc.y, { width: 500 });
                    doc.moveDown(0.4);
                });
                doc.moveDown(0.3);
            }
        } catch (e) {}

        drawField('CONTACTO ALT.', item.contacto_alt);
        doc.moveDown(0.3);

        const statusY = doc.y;
        doc.fontSize(10.5).font('Helvetica-Bold').text('STATUS SOCIAL:', 45, statusY);
        const est = item.status_social;
        doc.font('Helvetica').fontSize(10).text(`[ ${est === 'Estable' ? 'X' : ' '} ] ESTABLE    [ ${est === 'Precario' ? 'X' : ' '} ] PRECARIO    [ ${est === 'En Abandono' ? 'X' : ' '} ] EN ABANDONO`, 190, statusY);
        doc.moveDown(1.2);

        const dispY = doc.y;
        doc.fontSize(10.5).font('Helvetica-Bold').text('DISCAPACIDAD:', 45, dispY);
        const disp = item.discapacidad;
        doc.font('Helvetica').fontSize(10).text(`[ ${disp === 'No posee' ? 'X' : ' '} ] NO POSEE    [ ${disp === 'Sí posee' ? 'X' : ' '} ] SI POSEE  =>  ¿CUAL?: ${item.detalle_discapacidad || ''}`, 190, dispY);
        
        const signatureY = 700;
        doc.fontSize(9.5);
        doc.text('____________________________________', 60, signatureY);
        doc.text('____________________________________', 325, signatureY);
        
        doc.font('Helvetica-Bold').fontSize(9.5);
        doc.text('FIRMA DEL JUBILADO', 95, signatureY + 14);
        doc.text('FIRMA Y SELLO DE AJUPTEL CARABOBO', 335, signatureY + 14);

        doc.end();
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});