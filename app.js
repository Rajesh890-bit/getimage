const express = require('express');
const multer = require('multer');
const path = require('path');
const pdfPoppler = require('pdf-poppler');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const port = 3000;

// Middleware for parsing JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Define upload directory
const uploadDir = './uploads';

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

// Convert PDF to images
const convertPdfToImages = async (pdfPath, outputDir) => {
    try {
        const options = {
            format: 'jpeg',
            out_dir: outputDir,
            out_prefix: 'page',
            page: null,
            scale: 4096,
        };
        await pdfPoppler.convert(pdfPath, options);
    } catch (error) {
        throw new Error(`Error converting PDF to images: ${error.message}`);
    }
};

const sendFilesToLaravel = async (outputDir, editionDate, editionName) => {
    const files = fs.readdirSync(outputDir);

    for (const file of files) {
        const filePath = path.join(outputDir, file);
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath));
        formData.append('edition_date', editionDate);
        formData.append('edition_name', editionName);

        try {
            const response = await axios.post('https://www.satejnews.com/upload', formData, {
                headers: formData.getHeaders(),
            });
            console.log(`File ${file} uploaded successfully:`, response.data);
        } catch (error) {
            console.error(`Error uploading file ${file}:`, error.message);
        }
    }
};

const cleanup = (dir) => {
    fs.rmSync(dir, { recursive: true, force: true });
};

app.post('/convert', upload.single('pdf'), async (req, res) => {
    const pdfPath = req.file.path;
    const outputDir = path.join(__dirname, 'output', `${path.basename(pdfPath, '.pdf')}-${Date.now()}`);

    try {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        await convertPdfToImages(pdfPath, outputDir);

        const editionDate = req.body.edition_date;
        const editionName = req.body.edition_name;

        if (!editionDate || !editionName) {
            throw new Error('Edition date and name are required.');
        }

        await sendFilesToLaravel(outputDir, editionDate, editionName);

        res.json({
            success: true,
            message: 'PDF converted and files sent to Laravel',
            outputDir: outputDir,
        });

        // Cleanup temporary files
        cleanup(outputDir);
        fs.unlinkSync(pdfPath);
    } catch (error) {
        console.error('Error converting PDF:', error);
        res.status(500).json({ success: false, message: 'Conversion failed', error: error.message });
    }
});

app.get('/', (req, res) => {
    res.send('<h1>Welcome to the Home Page</h1><p>This is a basic Node.js app running on port 3000.</p>');
});

app.listen(port, () => {
    console.log(`Server is running on ${port}`);
});