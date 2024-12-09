const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { spawn } = require('child_process');
const { exec } = require('child_process');
const app = express();

const targetDir = path.resolve('/home/devops/Vahe/image-qr-code');
const outputDir = '/home/devops/Vahe/stable-diffusion-webui/outputs';
const fixedImagePath = '/home/devops/Vahe/stable-diffusion-webui/outputs/Camtest.jpg';

if (!fs.existsSync(targetDir)) {
    console.error(`Le dossier cible n'existe pas : ${targetDir}`);
    process.exit(1);
}

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

app.use(cors({
    origin: 'http://localhost:3001',
}));

app.use(express.json({ limit: '50mb' }));

const SSH_PASSPHRASE = 'Hello';

function handleStableDiffusion(scriptPath, newFileName, req, res) {
    console.log(`Lancement de ${scriptPath}...`);
    
    try {
        const latestImage = fixedImagePath; // Utilisation de l'image fixe pour tous les scripts
        console.log(`Utilisation de l'image fixe : ${latestImage}`);
        
        const pythonProcess = spawn('python', [
            scriptPath,
            latestImage
        ]);

        pythonProcess.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        pythonProcess.on('close', async (code) => {
            if (code === 0) {
                try {
                    const sourceFile = path.join(outputDir, 'output_image.png');
                    const targetFile = path.join(targetDir, newFileName);

                    if (!fs.existsSync(sourceFile)) {
                        console.error("Fichier source introuvable:", sourceFile);
                        res.status(500).send("Fichier source introuvable");
                        return;
                    }

                    await fs.promises.copyFile(sourceFile, targetFile);
                    await fs.promises.copyFile(targetFile, sourceFile);

                    const gitCommands = `
                        cd "${targetDir}" &&
                        git add "${newFileName}" &&
                        git commit -m "Ajout de l'image générée ${newFileName}" &&
                        git push origin main
                    `;

                    exec(gitCommands, (error, stdout, stderr) => {
                        if (error) {
                            console.error("Erreur Git:", error);
                            res.status(500).send("Erreur lors du push Git");
                            return;
                        }
                        res.status(200).json({ 
                            message: 'Script Python exécuté avec succès',
                            fileName: newFileName 
                        });
                    });
                } catch (err) {
                    console.error("Erreur lors de la copie ou du traitement du fichier:", err);
                    res.status(500).send("Erreur lors du traitement du fichier");
                }
            } else {
                res.status(500).send('Erreur lors de l\'exécution du script Python');
            }
        });
    } catch (error) {
        console.error("Erreur lors de la récupération de l'image:", error);
        res.status(500).send("Erreur lors de la récupération de l'image");
    }
}

app.post('/run-stable-diffusion', (req, res) => {
    const newFileName = `output_image_${Date.now()}.png`;
    handleStableDiffusion(
        '/home/devops/Vahe/stable-diffusion-webui/run_img2img.py',
        newFileName,
        req,
        res
    );
});

app.post('/run-stable-diffusion-squido', (req, res) => {
    const newFileName = `output_image_${Date.now()}.png`;
    handleStableDiffusion(
        '/home/devops/Vahe/stable-diffusion-webui/run_img2img_squido.py',
        newFileName,
        req,
        res
    );
});

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
        
        const gitCommands = `
            cd "${targetDir}" &&
            git add "${fileName}" &&
            git commit -m "Ajout de l'image ${fileName}" &&
            git push origin main
        `;
        
        exec(gitCommands, (error, stdout, stderr) => {
            if (error) {
                console.error("Erreur Git:", error);
                res.status(500).send("Erreur lors du push Git");
                return;
            }
            res.status(200).send(`Image uploadée et poussée avec succès. Fichier : ${filePath}`);
        });
    });
});

app.get('/output-image', (req, res) => {
    const imagePath = path.join(outputDir, 'output_image.png');
    
    if (fs.existsSync(imagePath)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        res.sendFile(imagePath);
    } else {
        res.status(404).send('Image non trouvée');
    }
});

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
