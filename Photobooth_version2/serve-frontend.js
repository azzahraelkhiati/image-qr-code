const express = require('express');
const path = require('path');

const app = express();

app.use(express.static(path.join(__dirname, 'single page')));

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Frontend accessible sur http://localhost:${PORT}`);
});
