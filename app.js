// app.js

document.addEventListener('DOMContentLoaded', () => {

    // --- Configuration ---
    const POST_ENDPOINT_URL = 'https://script.google.com/macros/s/AKfycbxWdUcvg8NjmBBasbQXqRWZm7DH9UyGevf7r6FHpN_1SOa99k5KXfSN-r5cSSl6lpIPrw/exec';
    const STORAGE_KEY_INDEX = 'deck_currentIndex';
    const STORAGE_KEY_RESULTS = 'deck_results';
    // Default URL for convenience during testing
    const DEFAULT_DATA_URL = ""; // e.g., "https://gist.githubusercontent.com/..."

    // --- Global State Variables ---
    let cardSets = []; // Will hold data loaded from JSON -> [cardsA, cardsB, cardsC]
    let totalComparisons = 0;
    let dataIsValid = false; // Flag to track if data loaded successfully

    // --- DOM Element References ---
    // Load Area
    const loadDataAreaEl = document.getElementById('load-data-area');
    const dataUrlInput = document.getElementById('data-url-input');
    const loadDataButton = document.getElementById('load-data-button');
    const loadStatusMessageEl = document.getElementById('load-status-message');
    // Main App Area
    const mainAppAreaEl = document.getElementById('main-app-area');
    const statusMessageEl = document.getElementById('status-message');
    const comparisonAreaEl = document.getElementById('comparison-area');
    const cardContainerEl = document.getElementById('card-container');
    const scoringFormEl = document.getElementById('scoring-form');
    const scoreInputs = [
        document.getElementById('score_1'),
        document.getElementById('score_2'),
        document.getElementById('score_3')
    ];
    const validationErrorEl = document.getElementById('validation-error');
    const completionAreaEl = document.getElementById('completion-area');
    const totalResultsCountEl = document.getElementById('total-results-count');
    const controlsAreaEl = document.getElementById('controls-area');
    const submitToServerBtn = document.getElementById('submit-to-server-button');
    const submitStatusEl = document.getElementById('submit-status');
    const resetButton = document.getElementById('reset-button');

    // --- State Management (localStorage) ---
    let currentState = {
        currentIndex: 0,
        results: []
    };
    let currentDisplayOrder = [];

    // Load/Save/Reset functions (mostly same, but load depends on loaded data)
    function loadState() {
        try {
            const storedIndex = localStorage.getItem(STORAGE_KEY_INDEX);
            const storedResults = localStorage.getItem(STORAGE_KEY_RESULTS);

            // Only load index if data has been loaded and validated
            currentState.currentIndex = (dataIsValid && storedIndex !== null) ? parseInt(storedIndex, 10) : 0;
            currentState.results = storedResults !== null ? JSON.parse(storedResults) : [];

            if (isNaN(currentState.currentIndex) || currentState.currentIndex < 0 ) {
                 currentState.currentIndex = 0;
            }
             // Prevent index from going beyond available comparisons
            if (dataIsValid && currentState.currentIndex > totalComparisons) {
                currentState.currentIndex = totalComparisons;
            }
            if (!Array.isArray(currentState.results)) {
                 currentState.results = [];
            }

        } catch (e) {
            console.error("Error loading state from localStorage:", e);
            currentState = { currentIndex: 0, results: [] };
        }
        // Update button state only if data is valid
        if (dataIsValid) {
             updateSubmitButtonState();
        }
    }

    function saveState() {
         // Only save if data is valid (prevents saving state for non-existent data)
        if (!dataIsValid) return;
        try {
            localStorage.setItem(STORAGE_KEY_INDEX, currentState.currentIndex.toString());
            localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(currentState.results));
            updateSubmitButtonState();
        } catch (e) {
            console.error("Error saving state to localStorage:", e);
            alert("Could not save progress. LocalStorage might be full or disabled.");
        }
    }

    function resetState() {
        if (window.confirm("Are you sure you want to reset all progress and loaded data? You will need to reload data.")) {
            try {
                localStorage.removeItem(STORAGE_KEY_INDEX);
                localStorage.removeItem(STORAGE_KEY_RESULTS);
                // Reloading the page is the simplest way to reset to the initial 'load data' state
                window.location.reload();
            } catch (e) {
                console.error("Error resetting state:", e);
                alert("Could not reset progress.");
            }
        }
    }

    function updateSubmitButtonState() {
         // Only enable if data is valid and there are results
         const hasResults = currentState.results.length > 0;
         submitToServerBtn.disabled = !(dataIsValid && hasResults);
         totalResultsCountEl.textContent = currentState.results.length;
    }

    // --- Helper Functions ---
    function shuffleArray(array) {
        // Fisher-Yates (Knuth) Shuffle
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]]; // Swap elements
        }
        return array;
    }

    function isMinimalCard(cardData) {
        // Considered minimal if it has an ID but no name attribute
        return cardData && cardData.hasOwnProperty('id') && !cardData.hasOwnProperty('name');
    }

    function capitalize(str) {
        // ... (same as previous version)
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // --- Rendering Functions ---
    function renderCard(cardData) { // Removed 'label' parameter
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        const minimal = isMinimalCard(cardData);
        let title = `Unknown Card (${cardData.id || 'No ID'})`; // Default title
        let attributesHtml = '<p><i>Not Available</i></p>'; // Default attributes

        if (!minimal) {
            title = `${cardData.name} (${cardData.id || 'No ID'})`;
            attributesHtml = ''; // Reset for non-minimal cards
             // Build attributes list only if not minimal
            for (const key in cardData) {
                if (cardData.hasOwnProperty(key) && key !== 'id' && key !== 'name' && key !== 'img') {
                    attributesHtml += `<dt>${capitalize(key)}:</dt><dd>${cardData[key]}</dd>`;
                }
            }
            if (!attributesHtml) { // Handle case where name exists but no other attributes
                attributesHtml = '<p><i>No additional attributes.</i></p>';
            }
        }

        const imgHtml = cardData.img ? `<img src="/img/${cardData.img}" alt="${cardData.name || 'Card Image'}">` : '';

        cardEl.innerHTML = `
            <h3>${title}</h3>
            ${imgHtml}
            <dl>
                ${attributesHtml}
            </dl>
        `;
        return cardEl;
    }

    function displayComparison(index) {
         // Guard against running if data isn't ready
        if (!dataIsValid) {
             console.error("displayComparison called before data is ready.");
             return;
        }

        console.log(`displayComparison: Called with index ${index}. Total comparisons: ${totalComparisons}`);
        if (index >= 0 && index < totalComparisons) {
            statusMessageEl.textContent = `Comparing Set ${index + 1} of ${totalComparisons}`;
            cardContainerEl.innerHTML = '';
            scoringFormEl.reset();
            validationErrorEl.classList.add('hidden');
            validationErrorEl.textContent = '';

            scoreInputs.forEach(input => {
                input.readOnly = false;
                input.required = true;
            });

            const cardsForComparison = cardSets.map((set, originalIndex) => ({
                card: set[index],
                originalIndex: originalIndex
            }));

            currentDisplayOrder = shuffleArray(cardsForComparison);

            currentDisplayOrder.forEach((item, displayIndex) => {
                const cardElement = renderCard(item.card);
                if (cardElement) {
                    cardContainerEl.appendChild(cardElement);
                } else {
                    console.error("renderCard returned null/undefined for item:", item);
                }

                if (isMinimalCard(item.card)) {
                    const inputElement = scoreInputs[displayIndex];
                    inputElement.value = 0;
                    inputElement.readOnly = true;
                    inputElement.required = false;
                }
            });

            comparisonAreaEl.classList.remove('hidden');
            completionAreaEl.classList.add('hidden');
            controlsAreaEl.classList.remove('hidden'); // Show controls when comparison starts
            if (scoreInputs[0]) scoreInputs[0].focus();

        } else {
            displayCompletion();
            // Ensure controls are visible on completion too
            controlsAreaEl.classList.remove('hidden');
        }
    }


    // --- Event Handlers ---
    function handleScoreSubmit(event) {
        event.preventDefault();

        const scores = {}; // Store scores by original index (0, 1, 2)
        let allScoresValid = true;

         validationErrorEl.classList.add('hidden'); // Hide previous error

        // Read scores based on current display order
        currentDisplayOrder.forEach((item, displayIndex) => {
            const inputElement = scoreInputs[displayIndex];
            const score = parseInt(inputElement.value, 10);

            // Validate only if not read-only (i.e., not a minimal card)
            if (!inputElement.readOnly) {
                if (isNaN(score) || score < 0 || score > 10) {
                    allScoresValid = false;
                }
            }
            // Store score against the original card's index
            scores[item.originalIndex] = isNaN(score) ? null : score; // Use null if somehow NaN
        });

        if (!allScoresValid) {
            validationErrorEl.textContent = "Please enter numbers between 0 and 10 for all active cards.";
            validationErrorEl.classList.remove('hidden');
            return;
        }

        // Record results, mapping scores back to original A, B, C
        const currentIndex = currentState.currentIndex;
        const result = {
            comparisonIndex: currentIndex,
            cardA: cardSets[0][currentIndex], // Original card A data
            cardB: cardSets[1][currentIndex], // Original card B data
            cardC: cardSets[2][currentIndex], // Original card C data
            scoreA: scores[0],              // Score given to original card A
            scoreB: scores[1],              // Score given to original card B
            scoreC: scores[2],              // Score given to original card C
            timestamp: new Date().toISOString()
        };
        currentState.results.push(result);
        currentState.currentIndex++;

        saveState();
        displayComparison(currentState.currentIndex);
    }
    
    async function handleSubmitToServer() {
        const resultsToSubmit = currentState.results;

        if (resultsToSubmit.length === 0) {
            submitStatusEl.textContent = "No results to submit.";
            submitStatusEl.style.color = 'orange';
            return;
        }

        submitToServerBtn.disabled = true;
        resetButton.disabled = true; // Prevent reset during submit
        submitStatusEl.textContent = "Submitting...";
        submitStatusEl.style.color = 'blue';


        try {
            const response = await fetch(POST_ENDPOINT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Add any other headers like Authorization if needed
                },
                body: JSON.stringify(resultsToSubmit) // Send all collected results
            });

            if (response.ok) {
                const responseData = await response.json(); // Or response.text() if not JSON
                console.log("Server Response:", responseData);
                submitStatusEl.textContent = "Results submitted successfully!";
                submitStatusEl.style.color = 'green';
                // Optional: Clear results after successful submission?
                // currentState.results = [];
                // saveState(); // If you clear results, save the empty state
            } else {
                // Handle HTTP errors (e.g., 404, 500)
                const errorText = await response.text();
                console.error("Server error:", response.status, response.statusText, errorText);
                submitStatusEl.textContent = `Error: ${response.status} ${response.statusText}. Check console.`;
                submitStatusEl.style.color = 'red';
            }
        } catch (error) {
            // Handle network errors or issues with the fetch itself
            console.error("Network or fetch error:", error);
            submitStatusEl.textContent = "Network error. Could not submit.";
            submitStatusEl.style.color = 'red';
        } finally {
            // Re-enable buttons regardless of success/failure
            updateSubmitButtonState(); // Re-evaluates based on results array
            resetButton.disabled = false;
            // Maybe clear the status message after a few seconds
            // setTimeout(() => { submitStatusEl.textContent = ''; }, 5000);
        }
    }
    

    // --- Data Loading ---
    async function loadDataFromUrl(url) {
        loadDataButton.disabled = true;
        loadStatusMessageEl.textContent = "Loading data...";
        loadStatusMessageEl.style.color = 'blue';
        dataIsValid = false; // Assume invalid until successfully loaded

        try {
            // Basic URL format check (optional but helpful)
            new URL(url);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // *** Data Structure Validation ***
            // Expecting an object like: { "cardsA": [...], "cardsB": [...], "cardsC": [...] }
            if (typeof data !== 'object' || data === null ||
                !Array.isArray(data.cardsA) ||
                !Array.isArray(data.cardsB) ||
                !Array.isArray(data.cardsC)) {
                throw new Error("Invalid JSON structure. Expected object with 'cardsA', 'cardsB', 'cardsC' arrays.");
            }

            const loadedSets = [data.cardsA, data.cardsB, data.cardsC];
            const firstSetLength = loadedSets[0].length;

            // Check for non-empty and equal lengths
            if (firstSetLength === 0 || !loadedSets.every(set => set.length === firstSetLength)) {
                 throw new Error("Card sets must be non-empty and have equal lengths.");
            }

            // *** Success! Assign data and initialize ***
            cardSets = loadedSets;
            totalComparisons = firstSetLength;
            dataIsValid = true; // Mark data as valid

            loadStatusMessageEl.textContent = `Successfully loaded ${totalComparisons} comparison sets.`;
            loadStatusMessageEl.style.color = 'green';

            // Hide loading UI, show main app
            loadDataAreaEl.classList.add('hidden');
            mainAppAreaEl.classList.remove('hidden');

            // Now initialize the application logic
            initializeAppLogic();


        } catch (error) {
            console.error("Failed to load or process data:", error);
            loadStatusMessageEl.textContent = `Error loading data: ${error.message}`;
            loadStatusMessageEl.style.color = 'red';
            loadDataButton.disabled = false; // Re-enable button on error
        }
    }


    // --- Initialization Logic (Separated) ---
    function initializeAppLogic() {
        // This part runs *after* data is successfully loaded

        if (!dataIsValid) {
            console.error("initializeAppLogic called but data is not valid.");
            // Potentially show an error in the main app area if needed
            return;
        }

        console.log("initializeAppLogic: Starting...");
        loadState(); // Load progress based on the now-valid data
        console.log("initializeAppLogic: State loaded. Current index:", currentState.currentIndex);

        // Attach event listeners (only once)
        // Check if already attached to prevent duplicates if loading new data was possible
        if (!scoringFormEl.dataset.listenerAttached) {
             scoringFormEl.addEventListener('submit', handleScoreSubmit);
             resetButton.addEventListener('click', resetState);
             submitToServerBtn.addEventListener('click', handleSubmitToServer);
             scoringFormEl.dataset.listenerAttached = 'true'; // Mark as attached
         }


        console.log("initializeAppLogic: Calling displayComparison for index", currentState.currentIndex);
        displayComparison(currentState.currentIndex); // Display current step

        console.log("initializeAppLogic: Finished.");
    }

    // --- Initial Page Setup ---
    function setupPage() {
        // Set default URL if provided
        if (DEFAULT_DATA_URL) {
            dataUrlInput.value = DEFAULT_DATA_URL;
        }

        // Add listener for the load button
        loadDataButton.addEventListener('click', async () => {
            const url = dataUrlInput.value.trim();
            if (url) {
                await loadDataFromUrl(url);
            } else {
                loadStatusMessageEl.textContent = "Please enter a valid URL.";
                loadStatusMessageEl.style.color = 'orange';
            }
        });
         // Note: We DO NOT call initializeAppLogic() here.
         // It's only called after successful data load.
    }

    // Start the page setup
    setupPage();

});
