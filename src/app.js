const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const cors = require('cors');
const os = require('os');
const chokidar = require('chokidar');

const app = express();
const PORT = process.env.PORT || 3000;
const execPromise = util.promisify(exec);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(express.static(path.join(__dirname, 'public')));

// Output folder
const outputFolder = path.resolve(__dirname, 'outputs');
async function ensureOutputFolder() {
    try {
        await fs.mkdir(outputFolder, { recursive: true });
        console.log('Output folder ready:', outputFolder);
        const testFile = path.join(outputFolder, 'test.txt');
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);
        console.log('Output folder is writable');
    } catch (err) {
        console.error('Failed to create or write to output folder:', err);
    }
}
ensureOutputFolder();

// Wait for file to exist
async function waitForFile(filePath, timeout = 60000) {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
        const watcher = chokidar.watch(filePath);
        watcher.on('add', () => {
            console.log(`File detected: ${filePath}, time taken: ${Date.now() - startTime}ms`);
            watcher.close();
            resolve(filePath);
        });
        watcher.on('error', (err) => {
            watcher.close();
            reject(new Error(`File watch error: ${err.message}`));
        });
        setTimeout(() => {
            watcher.close();
            reject(new Error(`Timeout waiting for file: ${filePath}`));
        }, timeout);
    });
}

// Validate Python and pdf2docx
async function validatePython() {
    try {
        // Check Python executable path
        const { stdout: pythonPath } = await execPromise('which python3', { timeout: 10000 });
        console.log('Python executable path:', pythonPath.trim());

        // Check Python version
        const { stdout: versionStdout, stderr: versionStderr } = await execPromise('python3 --version', { timeout: 10000 });
        console.log('Python version:', versionStdout.trim());
        if (versionStderr) console.warn('Python version stderr:', versionStderr);

        // Parse Python version
        const versionMatch = versionStdout.match(/Python (\d+)\.(\d+)\.(\d+)/);
        if (!versionMatch) {
            throw new Error('Unable to parse Python version');
        }
        const [_, major, minor] = versionMatch;
        if (parseInt(major) < 3 || (parseInt(major) === 3 && parseInt(minor) < 6)) {
            throw new Error('Python 3.6+ is required for pdf2docx');
        }

        // Check pdf2docx installation
        const { stdout: pipOutput, stderr: pipStderr } = await execPromise('pip3 show pdf2docx', { timeout: 10000 });
        console.log('pdf2docx installed:', pipOutput.includes('Name: pdf2docx') ? 'Yes' : 'No');
        if (pipStderr) console.warn('pip show stderr:', pipStderr);
        if (!pipOutput.includes('Name: pdf2docx')) {
            throw new Error('pdf2docx is not installed. Run: pip3 install pdf2docx opencv-python-headless PyPDF2');
        }
        return true;
    } catch (err) {
        console.error('Python validation failed:', err.message);
        return false;
    }
}

// Basic PDF file validation
async function validatePdf(filePath) {
    try {
        const data = await fs.readFile(filePath);
        if (!data.toString('ascii', 0, 4).startsWith('%PDF')) {
            throw new Error('File is not a valid PDF');
        }
        console.log('Basic PDF validation passed:', filePath);
        return true;
    } catch (err) {
        console.error('PDF validation failed:', err.message);
        return false;
    }
}

// Search for output file
async function findOutputFile(fileName) {
    const possibleLocations = [
        outputFolder,
        process.cwd(),
        os.homedir(),
        os.tmpdir(),
        path.join(os.homedir(), 'Documents')
    ];
    for (const location of possibleLocations) {
        const filePath = path.join(location, fileName);
        if (await fs.access(filePath).then(() => true).catch(() => false)) {
            console.log(`Found output file at: ${filePath}`);
            return filePath;
        }
    }
    return null;
}

// Route: homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route: convert PDF to Word
app.post('/api/convert', async (req, res) => {
    const startTime = Date.now();
    try {
        console.log('Received files:', req.files);
        if (!req.files || !req.files.pdf) {
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }

        // Validate Python and pdf2docx
        const pythonAvailable = await validatePython();
        if (!pythonAvailable) {
            return res.status(500).json({ 
                error: 'Python 3.6+ or pdf2docx is not installed. Run "python3 --version" to check version and "pip3 install pdf2docx opencv-python-headless PyPDF2" to install dependencies.'
            });
        }

        // Handle single or multiple files
        let pdfFiles = Array.isArray(req.files.pdf) ? req.files.pdf : [req.files.pdf];
        const convertedFiles = [];

        // Process files in parallel
        await Promise.all(pdfFiles.map(async (pdfFile) => {
            const fileStartTime = Date.now();
            const inputPath = path.join(outputFolder, pdfFile.name);
            console.log('Saving PDF to:', inputPath);
            await pdfFile.mv(inputPath);

            // Validate PDF
            if (!await validatePdf(inputPath)) {
                throw new Error(`Invalid PDF: ${pdfFile.name}`);
            }

            const outputFileName = pdfFile.name.replace(/\.pdf$/i, '.docx');
            const outputPath = path.join(outputFolder, outputFileName);
            console.log('Expected output:', outputPath);

            // Convert PDF to Word using pdf2docx
            let success = false;
            let lastError = null;
            const command = `python3 "${path.join(__dirname, 'convert.py')}" "${inputPath}" "${outputPath}"`;
            try {
                console.log('Executing pdf2docx command:', command);
                const { stdout, stderr } = await execPromise(command, { timeout: 60000 });
                console.log('pdf2docx stdout:', stdout);
                if (stderr) console.warn('pdf2docx stderr:', stderr);

                // Wait for output file
                await waitForFile(outputPath);
                const foundOutputPath = await findOutputFile(outputFileName);
                if (foundOutputPath) {
                    convertedFiles.push({ outputPath: foundOutputPath, outputFileName });
                    success = true;
                    console.log(`Conversion of ${pdfFile.name} completed in ${Date.now() - fileStartTime}ms`);
                }
            } catch (err) {
                console.error('Conversion failed:', { error: err.message, stderr: err.stderr, stack: err.stack });
                lastError = err;
            }

            if (!success) {
                for (const location of [outputFolder, process.cwd(), os.homedir(), os.tmpdir(), path.join(os.homedir(), 'Documents')]) {
                    const contents = await fs.readdir(location).catch(() => []);
                    console.log(`Contents of ${location}:`, contents);
                }
                console.error('Converted file not found at:', outputPath);
                throw new Error(`Conversion failed for ${pdfFile.name}: ${lastError?.stderr || lastError?.message || 'No output file generated'}`);
            }
        }));

        console.log(`Total conversion time: ${Date.now() - startTime}ms`);

        // Send the first file for download
        const { outputPath, outputFileName } = convertedFiles[0];
        console.log('Sending file for download:', outputPath);
        res.download(outputPath, outputFileName, async (err) => {
            if (err) {
                console.error('Download error:', err);
            }
            // Clean up all files
            try {
                for (const file of pdfFiles) {
                    const inputPath = path.join(outputFolder, file.name);
                    await fs.unlink(inputPath).catch(() => {});
                }
                for (const { outputPath } of convertedFiles) {
                    await fs.unlink(outputPath).catch(() => {});
                }
                console.log('Cleaned up temporary files');
            } catch (cleanupErr) {
                console.error('Cleanup error:', cleanupErr);
            }
        });
    } catch (err) {
        console.error('Server error:', { error: err.message, stack: err.stack });
        res.status(500).json({ error: `Server error: ${err.message}` });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
});
