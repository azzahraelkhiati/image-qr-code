const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { spawn } = require('child_process');
const app = express();

const targetDir = path.resolve('/home/devops/Vahe/image-qr-code');

if (!fs.existsSync(targetDir)) {
    console.error(`Le dossier cible n'existe pas : ${targetDir}`);
    process.exit(1);
}

app.use(cors({
    origin: 'http://localhost:3001', 
}));

app.use(express.json({ limit: '50mb' })); 

const SSH_PASSPHRASE = 'Hello';

app.post('/run-stable-diffusion', (req, res) => {
    console.log('Lancement de Stable Diffusion...');
    const pythonProcess = spawn('python', ['/home/devops/Vahe/stable-diffusion-webui/run_img2img.py']);

    pythonProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        if (code === 0) {
            res.status(200).send('Script Python exécuté avec succès');
        } else {
            res.status(500).send('Erreur lors de l\'exécution du script Python');
        }
    });
});

app.post('/upload', (req, res) => {
    console.log('Requête reçue :', req.body);
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
        
        console.log(`Fichier enregistré : ${filePath}`);
        
        const gitCommands = `
            git -C "${targetDir}" add "${fileName}" &&
            git -C "${targetDir}" commit -m "Ajout de l'image ${fileName}" &&
            git -C "${targetDir}" push origin main
        `;
        
        const child = spawn('sh', ['-c', gitCommands], {
            env: { ...process.env, SSH_ASKPASS: './askpass.sh' },
        });
        
        child.stdin.write(`${SSH_PASSPHRASE}\n`);
        child.stdin.end();
        
        child.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });
        
        child.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                res.status(200).send(`Image uploadée et poussée avec succès. Fichier : ${filePath}`);
            } else {
                res.status(500).send('Erreur lors du push Git');
            }
        });
    });
});

app.get('/output-image', (req, res) => {
    const imagePath = '/home/devops/Vahe/stable-diffusion-webui/outputs/output_image.png';
    
    if (fs.existsSync(imagePath)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        res.sendFile(imagePath, {
            headers: {
                'Content-Type': 'image/png'
            }
        });
    } else {
        res.status(404).send('Image non trouvée');
    }
});

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});