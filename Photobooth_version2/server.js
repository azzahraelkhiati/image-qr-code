const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { exec } = require('child_process');
const app = express();

// Dossier racine du dépôt Git
const targetDir = 'C:/Users/azzah/OneDrive/Bureau/CDRIN/image-qr-code';

if (!fs.existsSync(targetDir)) {
    console.error(`Le dossier cible n'existe pas : ${targetDir}`);
    process.exit(1);
}

app.use(cors({
    origin: 'http://localhost:3001',
}));

app.use(express.json({ limit: '50mb' }));

app.post('/upload', (req, res) => {
    const { imageData, fileName } = req.body;
    if (!imageData || !fileName) {
        return res.status(400).send('Données manquantes');
    }
    
    const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
    const filePath = path.join(targetDir, fileName);
    
    fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) {
            console.error('Erreur lors de l\'écriture du fichier :', err);
            return res.status(500).send('Erreur lors de l\'écriture du fichier');
        }

        const gitCommands = 'git add . && git commit -m "Ajout de l\'image" && git push origin main';
        
        exec(gitCommands, { cwd: targetDir }, (error, stdout, stderr) => {
            console.log('Git stdout:', stdout);
            console.error('Git stderr:', stderr);
            if (error) {
                console.error("Erreur Git:", error);
                return res.status(500).send("Erreur lors du push Git");
            }
            res.status(200).json({ 
                message: "Image uploadée et poussée avec succès.",
                fileName: fileName 
            });
        });
    });
});

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
