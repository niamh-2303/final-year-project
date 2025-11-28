// Function to convert an ArrayBuffer to a hexadecimal string
function bufferToHex(buffer) {
    const hashArray = Array.from(new Uint8Array(buffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Calculate SHA-256 hash
async function calculateSHA256(file) {
    if (!file) return 'No file selected.';

    try {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        return bufferToHex(hashBuffer);
    } catch (error) {
        console.error("Error calculating hash:", error);
        return 'Error during hash calculation.';
    }
}

// Extract EXIF metadata using EXIF.js
function extractMetadata(file) {
    return new Promise((resolve, reject) => {
        EXIF.getData(file, function() {
            const allMetaData = EXIF.getAllTags(this);
            
            if (Object.keys(allMetaData).length === 0) {
                resolve(null); // No EXIF data found
            } else {
                resolve(allMetaData);
            }
        });
    });
}

// Format GPS coordinates
function formatGPS(gpsData, ref) {
    if (!gpsData || gpsData.length !== 3) return null;
    
    const degrees = gpsData[0];
    const minutes = gpsData[1];
    const seconds = gpsData[2];
    
    const decimal = degrees + (minutes / 60) + (seconds / 3600);
    return `${decimal.toFixed(6)}° ${ref}`;
}

// Display metadata in table
function displayMetadata(metadata, file) {
    const tbody = document.getElementById('metadataBody');
    tbody.innerHTML = ''; // Clear previous content

    // Add basic file info first
    addMetadataRow(tbody, 'File Name', file.name);
    addMetadataRow(tbody, 'File Size', formatFileSize(file.size));
    addMetadataRow(tbody, 'File Type', file.type);
    addMetadataRow(tbody, 'Last Modified', new Date(file.lastModified).toLocaleString());

    if (!metadata || Object.keys(metadata).length === 0) {
        const row = tbody.insertRow();
        row.insertCell(0).innerHTML = '<strong>EXIF Data</strong>';
        row.insertCell(1).textContent = 'No EXIF metadata found in this file';
        return;
    }

    // Add separator
    const separatorRow = tbody.insertRow();
    separatorRow.innerHTML = '<td colspan="2"><strong>--- EXIF Metadata ---</strong></td>';

    // Important EXIF fields
    const importantFields = {
        'Make': 'Camera Make',
        'Model': 'Camera Model',
        'DateTime': 'Date/Time',
        'DateTimeOriginal': 'Date Taken',
        'DateTimeDigitized': 'Date Digitized',
        'Orientation': 'Orientation',
        'XResolution': 'X Resolution',
        'YResolution': 'Y Resolution',
        'Software': 'Software',
        'Artist': 'Artist/Author',
        'Copyright': 'Copyright',
        'ExposureTime': 'Exposure Time',
        'FNumber': 'F-Number',
        'ISO': 'ISO Speed',
        'FocalLength': 'Focal Length',
        'Flash': 'Flash',
        'WhiteBalance': 'White Balance',
        'PixelXDimension': 'Image Width',
        'PixelYDimension': 'Image Height'
    };

    // Display important fields
    Object.keys(importantFields).forEach(key => {
        if (metadata[key] !== undefined) {
            addMetadataRow(tbody, importantFields[key], formatValue(metadata[key]));
        }
    });

    // Handle GPS data specially
    if (metadata.GPSLatitude && metadata.GPSLongitude) {
        const lat = formatGPS(metadata.GPSLatitude, metadata.GPSLatitudeRef);
        const lon = formatGPS(metadata.GPSLongitude, metadata.GPSLongitudeRef);
        
        if (lat && lon) {
            addMetadataRow(tbody, 'GPS Latitude', lat);
            addMetadataRow(tbody, 'GPS Longitude', lon);
        }
    }

    if (metadata.GPSAltitude) {
        addMetadataRow(tbody, 'GPS Altitude', `${metadata.GPSAltitude} meters`);
    }

    // Add separator for other fields
    const otherSeparator = tbody.insertRow();
    otherSeparator.innerHTML = '<td colspan="2"><strong>--- All Other EXIF Data ---</strong></td>';

    // Display all other fields
    Object.keys(metadata).forEach(key => {
        if (!importantFields[key] && !key.startsWith('GPS') && !key.includes('thumbnail')) {
            addMetadataRow(tbody, key, formatValue(metadata[key]));
        }
    });
}

// Helper function to add a row to the metadata table
function addMetadataRow(tbody, property, value) {
    const row = tbody.insertRow();
    row.insertCell(0).innerHTML = `<strong>${property}</strong>`;
    row.insertCell(1).textContent = value;
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Format metadata values
function formatValue(value) {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'object') return JSON.stringify(value);
    return value.toString();
}

// Clear file and output
function clearFileAndOutput() {
    const fileInput = document.getElementById('fileInput');
    const hashOutput = document.getElementById('hashOutput');
    const clearButton = document.getElementById('clearFileButton');
    const resultsSection = document.getElementById('resultsSection');

    fileInput.value = ''; 
    hashOutput.textContent = 'Calculating...';
    clearButton.style.display = 'none';
    resultsSection.classList.add('hidden');
}

// Main event listener for file upload
document.getElementById('fileInput').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    const hashOutput = document.getElementById('hashOutput');
    const clearButton = document.getElementById('clearFileButton');
    const resultsSection = document.getElementById('resultsSection');
    
    if (file) {
        // Show results section
        resultsSection.classList.remove('hidden');
        
        // Calculate hash
        hashOutput.textContent = `Calculating hash for "${file.name}"...`;
        const hash = await calculateSHA256(file);
        hashOutput.textContent = hash;
        
        // Extract and display metadata
        const metadataBody = document.getElementById('metadataBody');
        metadataBody.innerHTML = '<tr><td colspan="2">Extracting metadata...</td></tr>';
        
        const metadata = await extractMetadata(file);
        displayMetadata(metadata, file);
        
        // Show clear button
        clearButton.style.display = 'inline-block';
    } else {
        clearFileAndOutput();
    }
});

// Clear button event listener
document.getElementById('clearFileButton').addEventListener('click', clearFileAndOutput);