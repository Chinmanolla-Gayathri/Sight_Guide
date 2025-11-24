const imageInput = document.getElementById('imageInput');
const locationInput = document.getElementById('locationInput');
const preview = document.getElementById('preview');
const previewContainer = document.getElementById('previewContainer');
const uploadText = document.getElementById('uploadText');
const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const resultContainer = document.getElementById('result');
const uploadCard = document.getElementById('uploadCard');
const closeBtn = document.getElementById('closeBtn');

// Chat Elements
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const chatHistory = document.getElementById('chatHistory');

// Map Picker Elements
const mapPickerBtn = document.getElementById('mapPickerBtn');
const mapModal = document.getElementById('mapModal');
const closeMapBtn = document.getElementById('closeMapBtn');
const confirmLocationBtn = document.getElementById('confirmLocationBtn');
const locateMeBtn = document.getElementById('locateMeBtn');

let currentContext = {}; 
let pickerMap, marker;
let selectedAddress = "";

// 1. OPEN MAP MODAL
mapPickerBtn.addEventListener('click', () => {
    mapModal.classList.remove('hidden');
    
    // Initialize Map if not already done
    if (!pickerMap) {
        // Default View: London (until geolocation kicks in)
        pickerMap = L.map('pickerMap').setView([51.505, -0.09], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(pickerMap);

        marker = L.marker([51.505, -0.09], { draggable: true }).addTo(pickerMap);

        // Event: When marker is dragged
        marker.on('dragend', async function(e) {
            const latlng = marker.getLatLng();
            await reverseGeocode(latlng.lat, latlng.lng);
        });
    }

    // Fix for Leaflet map rendering in hidden modal
    setTimeout(() => { pickerMap.invalidateSize(); }, 100);
});

// 2. REVERSE GEOCODING (Lat/Lng -> Address string)
async function reverseGeocode(lat, lng) {
    confirmLocationBtn.textContent = "Fetching address...";
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if(data && data.display_name) {
            selectedAddress = data.display_name;
            confirmLocationBtn.textContent = `Confirm: ${data.address.city || data.address.town || "Selected Location"}`;
        }
    } catch (e) {
        confirmLocationBtn.textContent = "Confirm Location";
    }
}

// 3. GEOLOCATION (Use my current location)
locateMeBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
        locateMeBtn.textContent = "Locating...";
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                pickerMap.setView([lat, lng], 15);
                marker.setLatLng([lat, lng]);
                await reverseGeocode(lat, lng);
                locateMeBtn.textContent = "Target My Location";
            },
            () => { alert("Could not get your location."); locateMeBtn.textContent = "Target My Location"; }
        );
    } else {
        alert("Geolocation is not supported by this browser.");
    }
});

// 4. CONFIRM LOCATION
confirmLocationBtn.addEventListener('click', () => {
    if(selectedAddress) {
        locationInput.value = selectedAddress;
        checkInputs();
        mapModal.classList.add('hidden');
    }
});

closeMapBtn.addEventListener('click', () => {
    mapModal.classList.add('hidden');
});


// --- STANDARD APP LOGIC BELOW ---

function checkInputs() {
    if (imageInput.files.length > 0 || locationInput.value.trim() !== "") {
        analyzeBtn.disabled = false;
    } else {
        analyzeBtn.disabled = true;
    }
}

imageInput.addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            previewContainer.classList.remove('hidden');
            uploadText.textContent = "Image loaded!";
            locationInput.value = ""; 
            checkInputs();
        }
        reader.readAsDataURL(file);
    }
});

locationInput.addEventListener('input', checkInputs);

// Handle Analysis
analyzeBtn.addEventListener('click', async () => {
    loading.classList.remove('hidden');
    analyzeBtn.disabled = true;

    const formData = new FormData();
    
    if (imageInput.files[0]) {
        formData.append('image', imageInput.files[0]);
    }
    if (locationInput.value.trim() !== "") {
        formData.append('location', locationInput.value);
    }

    try {
        const response = await fetch('/analyze', { method: 'POST', body: formData });
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // Store context
        currentContext = {
            name: data.landmarkName,
            location: data.location,
            history: data.history
        };

        document.getElementById('landmarkName').textContent = data.landmarkName;
        document.getElementById('location').textContent = data.location;
        document.getElementById('description').textContent = data.description;
        
        const mapQuery = encodeURIComponent(`${data.landmarkName} ${data.location}`);
        document.getElementById('mapsLink').href = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

        document.getElementById('history').textContent = data.history;

        const foodList = document.getElementById('foodList');
        foodList.innerHTML = '';
        data.food.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            foodList.appendChild(li);
        });

        const itineraryList = document.getElementById('itineraryList');
        itineraryList.innerHTML = '';
        data.itinerary.forEach((dayPlan, index) => {
            const div = document.createElement('div');
            div.innerHTML = `<strong>Day ${index + 1}:</strong>   ${dayPlan}`;
            itineraryList.appendChild(div);
        });

        chatHistory.innerHTML = '<div class="message bot-message">Hello! I know all about ' + data.landmarkName + '. Ask me anything!</div>';

        uploadCard.classList.add('hidden');
        resultContainer.classList.remove('hidden');

    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        loading.classList.add('hidden');
        analyzeBtn.disabled = false;
    }
});

// Handle Chat
sendChatBtn.addEventListener('click', async () => {
    const question = chatInput.value.trim();
    if (!question) return;

    appendMessage(question, 'user-message');
    chatInput.value = '';

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                context: currentContext,
                question: question
            })
        });
        const data = await response.json();
        appendMessage(data.answer, 'bot-message');

    } catch (error) {
        appendMessage("Sorry, I couldn't fetch an answer.", 'bot-message');
    }
});

function appendMessage(text, className) {
    const div = document.createElement('div');
    div.classList.add('message', className);
    div.textContent = text;
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

closeBtn.addEventListener('click', () => {
    resultContainer.classList.add('hidden');
    uploadCard.classList.remove('hidden');
});
// --- ABOUT MODAL LOGIC ---
const aboutLink = document.getElementById('aboutLink');
const aboutModal = document.getElementById('aboutModal');
const closeAboutBtn = document.getElementById('closeAboutBtn');

aboutLink.addEventListener('click', (e) => {
    e.preventDefault(); // Stop the link from jumping to top of page
    aboutModal.classList.remove('hidden');
});

closeAboutBtn.addEventListener('click', () => {
    aboutModal.classList.add('hidden');
});

// Close modal if clicking outside the box
window.addEventListener('click', (e) => {
    if (e.target === aboutModal) {
        aboutModal.classList.add('hidden');
    }
    if (e.target === mapModal) {
        mapModal.classList.add('hidden');
    }
});
// --- HOME BUTTON (RESET) ---
const homeLink = document.getElementById('homeLink');

homeLink.addEventListener('click', (e) => {
    e.preventDefault();
    // Hide Results, Show Upload Card
    resultContainer.classList.add('hidden');
    uploadCard.classList.remove('hidden');
    
    // Clear inputs
    locationInput.value = "";
    imageInput.value = "";
    previewContainer.classList.add('hidden');
    uploadText.textContent = "Drop image here or click to upload";
    
    // Disable button
    analyzeBtn.disabled = true;
    
    // Close any open modals
    mapModal.classList.add('hidden');
    aboutModal.classList.add('hidden');
    destModal.classList.add('hidden');
});


// --- DESTINATIONS MODAL & LOGIC ---
const destLink = document.getElementById('destinationsLink');
const destModal = document.getElementById('destModal');
const closeDestBtn = document.getElementById('closeDestBtn');

destLink.addEventListener('click', (e) => {
    e.preventDefault();
    destModal.classList.remove('hidden');
});

closeDestBtn.addEventListener('click', () => {
    destModal.classList.add('hidden');
});

// The function called when you click a picture in the Destinations modal
function quickSearch(locationName) {
    // 1. Close the modal
    destModal.classList.add('hidden');
    
    // 2. Set the value in the search bar
    locationInput.value = locationName;
    
    // 3. Reset image input (since we are searching by text)
    imageInput.value = "";
    previewContainer.classList.add('hidden');
    
    // 4. Trigger the standard analysis
    checkInputs(); // Enable the button
    analyzeBtn.click(); // Programmatically click the generate button
}

// Add to the window click listener (to close if clicking outside)
window.addEventListener('click', (e) => {
    if (e.target === aboutModal) aboutModal.classList.add('hidden');
    if (e.target === mapModal) mapModal.classList.add('hidden');
    if (e.target === destModal) destModal.classList.add('hidden');
});
