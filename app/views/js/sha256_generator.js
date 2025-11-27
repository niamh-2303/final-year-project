// Function to convert an ArrayBuffer to a hexadecimal string (keep this function)
function bufferToHex(buffer) {
    const hashArray = Array.from(new Uint8Array(buffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Main asynchronous function to calculate the SHA-256 hash (keep this function)
async function calculateSHA256(file) {
    if (!file) return 'No file selected.';

    // ... (rest of the hashing logic) ...
    try {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        return bufferToHex(hashBuffer);
    } catch (error) {
        console.error("Error calculating hash:", error);
        return 'Error during hash calculation.';
    }
}

// --- NEW FUNCTION: Clears the file input and output ---
function clearFileAndOutput() {
    const fileInput = document.getElementById('fileInput');
    const hashOutput = document.getElementById('hashOutput');
    const clearButton = document.getElementById('clearFileButton');

    // 1. Reset the file input value (This is key to allowing the user to select the same file again)
    fileInput.value = ''; 
    
    // 2. Clear the hash output display
    hashOutput.textContent = 'Awaiting file selection...';
    
    // 3. Hide the clear button
    clearButton.style.display = 'none';
}

// --- MODIFIED EVENT LISTENER: Triggers on file upload ---
document.getElementById('fileInput').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    const outputElement = document.getElementById('hashOutput');
    const clearButton = document.getElementById('clearFileButton');
    
    if (file) {
        outputElement.textContent = `Calculating hash for "${file.name}"...`;
        
        const hash = await calculateSHA256(file);
        
        // Display the hash and show the clear button
        outputElement.textContent = hash;
        clearButton.style.display = 'inline-block'; // Show the button after hash is calculated
    } else {
        // If the user cancels the selection
        clearFileAndOutput(); 
    }
});

// --- NEW EVENT LISTENER: Triggers on button click ---
document.getElementById('clearFileButton').addEventListener('click', clearFileAndOutput);