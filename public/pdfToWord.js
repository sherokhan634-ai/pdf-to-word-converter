let selectedFile = null;

function setStatus(message, isError = false) {
    const statusEl = document.getElementById('status');
    if (!statusEl) {
        console.error('Status element not found!');
        return;
    }
    
    if (message) {
        statusEl.textContent = message;
        statusEl.className = isError ? 'status error' : 'status';
        statusEl.style.display = 'block';
        statusEl.removeAttribute('hidden');
    } else {
        statusEl.textContent = '';
        statusEl.className = 'status';
        statusEl.style.display = 'none';
    }
    
    console.log('Status set to:', message, 'display:', statusEl.style.display);
}

function updateProgressBar(progress) {
    const progressBar = document.getElementById('progressBar');
    const progressContainer = document.getElementById('progressContainer');
    if (progressBar && progressContainer) {
        progressBar.style.width = `${progress}%`;
        if (progress === 0) {
            progressContainer.style.display = 'none';
        } else {
            progressContainer.style.display = 'block';
            progressContainer.removeAttribute('hidden');
        }
        console.log('Progress bar updated to:', progress, '%');
    }
}

function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'block';
        element.removeAttribute('hidden');
    }
}

function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
    }
}

function handleFileUpload(e) {
    const files = e.target.files;
    const convertBtn = document.getElementById('convertBtn');
    console.log('Handling file upload, files:', files);

    if (!files.length) {
        convertBtn.disabled = true;
        hideElement('fileInfo');
        hideElement('loading');
        hideElement('actions');
        selectedFile = null;
        setStatus('');
        console.log('No files selected');
        return;
    }

    let allValid = true;
    const fileList = [];
    for (const file of files) {
        if (file.type !== 'application/pdf') {
            setStatus('All files must be PDFs.', true);
            allValid = false;
            break;
        }
        if (file.size > 25 * 1024 * 1024) {
            setStatus('Each file must be 25MB or less.', true);
            allValid = false;
            break;
        }
        fileList.push(file);
    }

    if (!allValid) {
        convertBtn.disabled = true;
        hideElement('fileInfo');
        hideElement('loading');
        hideElement('actions');
        updateProgressBar(0);
        console.log('Invalid files detected');
        return;
    }

    selectedFile = fileList;
    const fileInfo = document.getElementById('fileInfo');
    fileInfo.innerHTML = fileList.map(file => `
        <div class="file-preview">
            <div class="preview-content">
                <div class="preview-icon">📄</div>
                <div class="preview-info">
                    <p class="preview-name">${file.name}</p>
                    <p class="preview-size">${(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
            </div>
        </div>
    `).join('');
    
    showElement('fileInfo');
    showElement('actions');
    hideElement('loading');
    convertBtn.disabled = false;
    setStatus('');
    console.log('Files valid, selectedFile:', selectedFile);
}

async function uploadWithProgress(file) {
    const form = new FormData();
    form.append('pdf', file);
    console.log('Uploading file:', file.name);

    const xhr = new XMLHttpRequest();
    return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = (e.loaded / e.total) * 100;
                updateProgressBar(percent);
                setStatus(`Uploading ${file.name}… ${Math.round(percent)}%`);
            }
        });
        xhr.addEventListener('load', async () => {
            if (xhr.status === 200) {
                console.log('Upload successful for:', file.name);
                resolve(xhr.response);
            } else {
                let errorMessage = 'Conversion failed.';
                try {
                    const tempXhr = new XMLHttpRequest();
                    tempXhr.open('POST', '/api/convert');
                    tempXhr.setRequestHeader('Content-Type', xhr.getRequestHeader('Content-Type'));
                    tempXhr.send(form);
                    await new Promise(resolve => {
                        tempXhr.addEventListener('load', () => {
                            try {
                                const errorData = JSON.parse(tempXhr.responseText);
                                errorMessage = errorData.error || errorMessage;
                            } catch (e) {
                                console.error('Error parsing error response:', e);
                            }
                            resolve();
                        });
                    });
                } catch (e) {
                    console.error('Error fetching error message:', e);
                }
                console.error('Upload failed for:', file.name, 'Status:', xhr.status, 'Message:', errorMessage);
                reject(new Error(errorMessage));
            }
        });
        xhr.addEventListener('error', () => {
            console.error('Network error during upload of:', file.name);
            reject(new Error('Upload failed due to network error.'));
        });
        xhr.open('POST', '/api/convert');
        xhr.responseType = 'blob';
        xhr.send(form);
    });
}

async function convertPdfToWord(pdfFiles) {
    console.log('Convert button clicked, selectedFile:', pdfFiles);
    
    if (!pdfFiles || !pdfFiles.length) {
        console.log('No files selected - showing error');
        setStatus('Please select a file to convert.', true);
        hideElement('loading');
        return;
    }

    setStatus('Uploading…');
    const convertBtn = document.getElementById('convertBtn');
    convertBtn.disabled = true;
    showElement('loading');

    try {
        for (const file of pdfFiles) {
            const response = await uploadWithProgress(file);
            setStatus(`Converting ${file.name}…`);
            const blob = new Blob([response], { 
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
            });
            const url = URL.createObjectURL(blob);
            const outName = file.name.replace(/\.pdf$/i, '.docx');
            const a = document.createElement('a');
            a.href = url;
            a.download = outName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            setStatus(`✅ ${file.name} converted and downloaded.`);
        }
        setStatus('✅ Done! All files have been downloaded.');
    } catch (err) {
        setStatus(err.message || 'Conversion failed.', true);
        console.error('Conversion error:', err);
    } finally {
        convertBtn.disabled = false;
        updateProgressBar(0);
        hideElement('loading');
    }
}

function resetTool() {
    selectedFile = null;
    const fileInputEl = document.getElementById('fileInput');
    if (fileInputEl) fileInputEl.value = '';
    
    hideElement('actions');
    hideElement('fileInfo');
    hideElement('loading');
    updateProgressBar(0);
    setStatus('');
    
    const convertBtn = document.getElementById('convertBtn');
    if (convertBtn) convertBtn.disabled = true;
    
    const oldPreviews = document.querySelectorAll('.file-preview');
    oldPreviews.forEach(preview => preview.remove());
    
    console.log('Tool reset, selectedFile:', selectedFile);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded, initializing UI');
    resetTool();
    
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    
    const convertBtn = document.getElementById('convertBtn');
    convertBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Convert button clicked! selectedFile:', selectedFile);
        convertPdfToWord(selectedFile);
    });
    
    document.getElementById('resetBtn').addEventListener('click', resetTool);
    
    document.getElementById('browseBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
    
    const dropzone = document.getElementById('dropzone');
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', (e) => {
        e.currentTarget.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        const fileInput = document.getElementById('fileInput');
        fileInput.files = e.dataTransfer.files;
        handleFileUpload({ target: fileInput });
    });

    console.log('Testing status element...');
    const statusEl = document.getElementById('status');
    console.log('Status element found:', !!statusEl);
    if (statusEl) {
        console.log('Status element display:', statusEl.style.display);
        console.log('Status element hidden attr:', statusEl.hidden);
    }
});