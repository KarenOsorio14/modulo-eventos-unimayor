require('dotenv').config();
const express = require('express');
const path = require('path');
require('./db'); // inicializa la base

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/eventos', require('./routes/eventos'));
app.use('/api', require('./routes/inscripciones'));

app.use('/api', (req, res) => res.status(404).json({ mensaje: 'Ruta no encontrada.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ mensaje: 'Error interno del servidor.' });
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`Servidor en http://localhost:${process.env.PORT || 3000}`));