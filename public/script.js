const imageInput = document.getElementById('imageInput');
const preview = document.getElementById('preview');
const previewContainer = document.getElementById('previewContainer');
const uploadText = document.getElementById('uploadText');
const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const resultContainer = document.getElementById('result');
const uploadCard = document.getElementById('uploadCard');
const closeBtn = document.getElementById('closeBtn');

// Handle File Preview
imageInput.addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            previewContainer.classList.remove('hidden');
            uploadText.textContent = "Image loaded!";
            analyzeBtn.disabled = false;
        }
        reader.readAsDataURL(file);
    }
});

// Handle Analysis
analyzeBtn.addEventListener('click', async () => {
    const file = imageInput.files[0];
    if (!file) return;

    // UI Transitions
    loading.classList.remove('hidden');
    analyzeBtn.disabled = true;

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch('/analyze', { method: 'POST', body: formData });
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // 1. Populate Header
        document.getElementById('landmarkName').textContent = data.landmarkName;
        document.getElementById('location').textContent = data.location;
        document.getElementById('description').textContent = data.description;
        
        // 2. Google Maps Link
        const mapQuery = encodeURIComponent(`${data.landmarkName} ${data.location}`);
        document.getElementById('mapsLink').href = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

        // 3. Populate History
        document.getElementById('history').textContent = data.history;

        // 4. Populate Food (List)
        const foodList = document.getElementById('foodList');
        foodList.innerHTML = ''; // Clear old data
        data.food.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            foodList.appendChild(li);
        });

        // 5. Populate Itinerary (Timeline)
        const itineraryList = document.getElementById('itineraryList');
        itineraryList.innerHTML = '';
        data.itinerary.forEach((dayPlan, index) => {
            const div = document.createElement('div');
            // Make Day bold
            div.innerHTML = `<strong>Day ${index + 1}:</strong> &nbsp; ${dayPlan}`;
            itineraryList.appendChild(div);
        });

        // Swap Views (Hide Upload, Show Result)
        uploadCard.classList.add('hidden');
        resultContainer.classList.remove('hidden');

    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        loading.classList.add('hidden');
        analyzeBtn.disabled = false;
    }
});

// Reset / Close Guide
closeBtn.addEventListener('click', () => {
    resultContainer.classList.add('hidden');
    uploadCard.classList.remove('hidden');
    // Optional: Reset form
    // imageInput.value = '';
    // previewContainer.classList.add('hidden');
});