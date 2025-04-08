document.addEventListener('DOMContentLoaded', () => {

    // --- Configuration ---
    const POST_ENDPOINT_URL = 'https://script.google.com/macros/s/AKfycbz_a4HaXLZJ4yeKzVC16cpb9nn8ofbvBjgB_OSmWSXaR3fHntem5sMn5vGjtCZ_p7s/exec';
    const SYNAPSE_USER_PROFILE_URL = 'https://repo-prod.prod.sagebase.org/repo/v1/userProfile';
    const STORAGE_KEY_INDEX = 'deck_currentIndex';
    const STORAGE_KEY_RESULTS = 'deck_results';
    const STORAGE_KEY_USERNAME = 'deck_username';
    // Default URL for convenience during testing
    const DEFAULT_DATA_URL = "https://raw.githubusercontent.com/nf-osi/jobs/refs/heads/dataset_curation/dataset_curation/test/results.json"; // e.g., "https://gist.githubusercontent.com/..."
    // Schema URL for the form
    const SCHEMA_URL = "https://raw.githubusercontent.com/nf-osi/nf-metadata-dictionary/refs/heads/main/registered-json-schemas/PortalDataset.json";

    // --- Global State Variables ---
    let cardSets = []; // Will hold data loaded from JSON -> [cardsA, cardsB, cardsC]
    let totalComparisons = 0;
    let dataIsValid = false; // Flag to track if data loaded successfully
    let isSubmitting = false; // Flag to prevent multiple submissions
    let apiKey = ""; 
    let username = ""; // Store the username
    let jsonSchema = null; // Will hold the loaded schema
    let selectedCardForEditing = null; // Will hold the card being edited
    let originalCardData = null; // Will hold the original card data for comparison
    let changedFields = []; // Will track which fields have been changed

    // --- DOM Element References ---
    // Load Area
    const loadDataAreaEl = document.getElementById('load-data-area');
    const apiKeyInput = document.getElementById('api-key-input');
    const dataUrlInput = document.getElementById('data-url-input');
    const loadDataButton = document.getElementById('load-data-button');
    const loadStatusMessageEl = document.getElementById('load-status-message');
    // Main App Area
    const mainAppAreaEl = document.getElementById('main-app-area');
    const statusMessageEl = document.getElementById('status-message');
    const submitStatusEl = document.getElementById('submit-status');
    const navigationAreaEl = document.getElementById('navigation-area');
    const gotoIndexInput = document.getElementById('goto-index');
    const gotoButton = document.getElementById('goto-button');
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
    const resetButton = document.getElementById('reset-button');
    // Elements for card editing
    const editCardAreaEl = document.getElementById('edit-card-area');
    const saveBtn = document.getElementById('save-card-changes');
    const backToComparisonBtn = document.getElementById('back-to-comparison');
    const saveCardChangesBtn = document.getElementById('save-card-changes');

    // --- State Management (localStorage) ---
    let currentState = {
        currentIndex: 0,
        results: []
    };
    let currentDisplayOrder = [];

    // Load/Save/Reset functions
    function loadState() {
        try {
            const storedIndex = localStorage.getItem(STORAGE_KEY_INDEX);
            const storedResults = localStorage.getItem(STORAGE_KEY_RESULTS);
            const storedUsername = localStorage.getItem(STORAGE_KEY_USERNAME);

            // Only load index if data has been loaded and validated
            currentState.currentIndex = (dataIsValid && storedIndex !== null) ? parseInt(storedIndex, 10) : 0;
            currentState.results = storedResults !== null ? JSON.parse(storedResults) : [];
            username = storedUsername || "";

            if (isNaN(currentState.currentIndex) || currentState.currentIndex < 0) {
                currentState.currentIndex = 0;
            }
            // Prevent index from going beyond available comparisons
            if (dataIsValid && currentState.currentIndex > totalComparisons) {
                currentState.currentIndex = totalComparisons;
            }
            if (!Array.isArray(currentState.results)) {
                currentState.results = [];
            }

            // Update the goto index input to match current index
            if (gotoIndexInput) {
                gotoIndexInput.value = currentState.currentIndex + 1;
                gotoIndexInput.max = totalComparisons;
            }

        } catch (e) {
            console.error("Error loading state from localStorage:", e);
            currentState = { currentIndex: 0, results: [] };
        }
        
        // Update results count
        updateResultsCount();
    }

    function saveState() {
        // Only save if data is valid (prevents saving state for non-existent data)
        if (!dataIsValid) return;
        try {
            localStorage.setItem(STORAGE_KEY_INDEX, currentState.currentIndex.toString());
            localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(currentState.results));
            localStorage.setItem(STORAGE_KEY_USERNAME, username);
            updateResultsCount();
            
            // Update the goto index input
            if (gotoIndexInput) {
                gotoIndexInput.value = currentState.currentIndex + 1;
            }
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
                localStorage.removeItem(STORAGE_KEY_USERNAME);
                // Reloading the page is the simplest way to reset to the initial 'load data' state
                window.location.reload();
            } catch (e) {
                console.error("Error resetting state:", e);
                alert("Could not reset progress.");
            }
        }
    }

    function updateResultsCount() {
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
        // Considered minimal if it has an ID but no title attribute
        return cardData && cardData.hasOwnProperty('id') && !cardData.hasOwnProperty('title');
    }

    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // --- Helper Functions for Synapse API ---

    function getAnnotationValueType(value) {
        if (value == null) return "STRING"; // null or undefined -> STRING type, value becomes []
        const type = typeof value;
        if (type === 'string') return "STRING";
        if (type === 'boolean') return "BOOLEAN";
        if (type === 'number') {
          return Number.isInteger(value) ? "LONG" : "DOUBLE";
        }
        if (Array.isArray(value)) return "STRING";
        return "STRING";
      }

    function asAnnotations(cardData) {
        if (typeof cardData !== 'object' || cardData === null) {
            console.error("Input must be a non-null object.");
            return {};
        }
        
        return Object.entries(cardData).reduce((accumulator, [key, originalValue]) => {
            // Skip if the value is an object, null, empty array, or empty string
            if (key === 'id' || 
                originalValue == null || 
                (typeof originalValue === 'object' && originalValue !== null && !Array.isArray(originalValue)) ||
                (Array.isArray(originalValue) && originalValue.length === 0) ||
                (typeof originalValue === 'string' && originalValue.trim() === '')) {
                console.warn(`Skipping annotation key "${key}"`);
                return accumulator; // Don't add this key to the result
            }
        
            const type = getAnnotationValueType(originalValue);
            let valueArray;
        
            if (Array.isArray(originalValue)) {
            // Convert each element to string, handles empty arrays correctly (value=[])
            valueArray = originalValue.map(item => String(item));
            } else {
            // Scalar value: wrap in array and convert to string
            valueArray = [String(originalValue)];
            }
        
            accumulator[key] = {
            type: type,
            value: valueArray // This is now always an array of strings (or empty)
            };
        
            return accumulator;
        }, {}); // Start with an empty object accumulator
    }
    
    // --- API Functions ---
    async function validateApiKey(key) {
        try {
            const response = await fetch(SYNAPSE_USER_PROFILE_URL, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${key}`
                }
            });

            if (!response.ok) {
                throw new Error(`API key validation failed: ${response.status} ${response.statusText}`);
            }

            const userData = await response.json();
            if (!userData.userName) {
                throw new Error('Invalid response from Synapse API');
            }

            return {
                valid: true,
                username: userData.userName
            };
        } catch (error) {
            console.error('API key validation error:', error);
            return {
                valid: false,
                error: error.message
            };
        }
    }

     // Function to get the highest-scoring card data for a given index
     function getHighestScoringCard(scores, index) {
        // Find the highest score
        let highestScore = -1;
        let highestIndex = -1;
        
        for (let i = 0; i < 3; i++) {
            const score = scores[i];
            if (score !== null && score > highestScore) {
                highestScore = score;
                highestIndex = i;
            }
        }
        
        // If we found a valid highest score
        if (highestIndex >= 0 && highestIndex < cardSets.length) {
            return {
                card: cardSets[highestIndex][index],
                score: highestScore,
                setIndex: highestIndex // A, B, or C (0, 1, or 2)
            };
        }
        
        return null;
    }

    async function submitCardData(cardData, apiKey) {
        id = cardData.id;
        const entity = await fetch(`https://repo-prod.prod.sagebase.org/repo/v1/entity/${id}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              }
            });
        
        const entityData = await entity.json();
        
        let annotations = { 
            "id": id, 
            "etag": entityData.etag, 
            "annotations": asAnnotations(cardData)}
        
        // console.log("Submitting", annotations)

        response = await fetch(`https://repo-prod.prod.sagebase.org/repo/v1/entity/${id}/annotations2`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(annotations),
        });

        if (response.ok) {
            console.log('Annotation submitted successfully');
            return true;
        } else {
            console.error('Failed to submit annotation');
        }
    }

    // --- Card Editing Functions ---
    
    // Function to load the JSON schema for the form
    async function loadJsonSchema() {
        try {
            const response = await fetch(SCHEMA_URL);
            if (!response.ok) {
                throw new Error(`Failed to load schema: ${response.status} ${response.statusText}`);
            }
            
            jsonSchema = await response.json();
            console.log('Schema loaded successfully:', jsonSchema);
            return true;
        } catch (error) {
            console.error('Error loading schema:', error);
            return false;
        }
    }

    // Function to open the edit form for a card
    function openEditForm(cardData, displayIndex) {
        console.log("Opening edit form for card:", cardData);
        
        if (!jsonSchema) {
            console.error("Schema not loaded. Cannot edit card.");
            alert("Schema not loaded. Cannot edit card.");
            return;
        }
        
        // Ensure we have an ID
        if (!cardData || !cardData.id) {
            console.error("Card is missing ID, cannot edit");
            alert("Error: Card is missing ID");
            return;
        }
        
        // Get the original set index (0, 1, or 2 for Set A, B, or C)
        // This is crucial since IDs are only unique within a set
        const originalSetIndex = currentDisplayOrder[displayIndex].originalIndex;
        
        // Save the original, unmodified card data for comparison later
        // Make a deep copy to ensure we don't have reference issues
        originalCardData = JSON.parse(JSON.stringify(cardData));
        
        // Store the set index as a property on the original data
        // This ensures we know which set this card belongs to
        originalCardData._setIndex = originalSetIndex;
        
        console.log(`Editing card with ID: ${originalCardData.id} from Set ${["A", "B", "C"][originalSetIndex]} (index: ${originalSetIndex})`);
        
        // Prepare the card data by filling in missing required fields with null values
        const preparedCardData = fillMissingRequiredFields(cardData, jsonSchema);
        
        // Store the set index on the prepared data too
        preparedCardData._setIndex = originalSetIndex;
        
        // Save the prepared card data (with a deep copy)
        selectedCardForEditing = JSON.parse(JSON.stringify(preparedCardData));
        
        // Store auto-filled fields info separately and then remove from the object
        window.autoFilledFields = preparedCardData._autoFilledFields || [];
        delete preparedCardData._autoFilledFields;
        
        console.log("Auto-filled fields:", window.autoFilledFields);
        
        // Hide comparison area and show edit area
        comparisonAreaEl.classList.add('hidden');
        editCardAreaEl.classList.remove('hidden');
        
        // Generate the form with our vanilla form generator
        try {
            // Check if the form generator functions are available
            if (typeof generateFormFromSchema !== 'function') {
                console.error("Form generator not loaded. Make sure form-generator.js is included.");
                return;
            }
            
            console.log(`Generating form from schema for card ID: ${preparedCardData.id} (Set ${["A", "B", "C"][originalSetIndex]})`);
            
            // Generate the form
            const form = generateFormFromSchema(jsonSchema, preparedCardData, 'vanilla-form-container');
            
            // Store form reference for later access
            window.currentForm = form;
            
            console.log("Form generated successfully");
        } catch (error) {
            console.error("Error generating form:", error);
        }
    }

    // Function to save changes made to the card
    function saveCardChanges() {
        if (!window.currentForm) {
            console.error("Form not found");
            return;
        }
        
        // Extract data from the form
        const formData = extractFormData(window.currentForm);
        if (!formData) {
            console.error("Could not extract form data");
            return;
        }
        
        console.log('Original data:', originalCardData);
        console.log('Form data after editing:', formData);
        
        // Ensure the ID is preserved from the original card
        if (originalCardData && originalCardData.id) {
            formData.id = originalCardData.id;
        }
        
        // Get the set index from the original data
        const setIndex = originalCardData._setIndex;
        if (setIndex === undefined) {
            console.error("Missing set index, cannot update card correctly");
            alert("Error: Cannot identify which set this card belongs to");
            return;
        }
        
        // Detect which fields were actually changed by user (ignoring auto-filled nulls)
        changedFields = detectActualChanges(originalCardData, formData);
        
        // Log the changes
        console.log(`Changed fields for card ID ${formData.id} in Set ${["A", "B", "C"][setIndex]}:`, changedFields);
        
        // IMPORTANT: First update the original card in its set
        // This is the authoritative data source
        let updatedInSet = false;
        const targetId = formData.id;
        
        // Navigate to the specific set and find the card by ID within that set
        if (cardSets[setIndex]) {
            for (let cardIndex = 0; cardIndex < cardSets[setIndex].length; cardIndex++) {
                if (cardSets[setIndex][cardIndex].id === targetId) {
                    console.log(`Found card in Set ${["A", "B", "C"][setIndex]} at index ${cardIndex}`);
                    
                    // Create a clean copy of the form data (without our internal properties)
                    const cleanData = { ...formData };
                    delete cleanData._setIndex; // Remove our tracking property
                    
                    // Update the card with the clean data
                    cardSets[setIndex][cardIndex] = cleanData;
                    
                    updatedInSet = true;
                    break;
                }
            }
        }
        
        if (!updatedInSet) {
            console.error(`Could not find card with ID ${targetId} in Set ${["A", "B", "C"][setIndex]}`);
            alert("Error: Card could not be found in its original set");
            return;
        }
        
        // Now update the card in the current display order if it's visible
        let updatedInDisplay = false;
        
        for (let i = 0; i < currentDisplayOrder.length; i++) {
            // We need to match BOTH the ID and the original set index
            if (currentDisplayOrder[i].card.id === targetId && 
                currentDisplayOrder[i].originalIndex === setIndex) {
                
                console.log(`Found card in display order at index ${i}`);
                
                // Create a clean copy of the form data
                const cleanData = { ...formData };
                delete cleanData._setIndex; // Remove our tracking property
                
                // Update the card with the clean data
                currentDisplayOrder[i].card = cleanData;
                
                updatedInDisplay = true;
                break;
            }
        }
        
        if (!updatedInDisplay) {
            console.warn(`Could not find card with ID ${targetId} from Set ${["A", "B", "C"][setIndex]} in current display order`);
            // Not critical - the card might not be visible in the current comparison
        }
        
        // Cleanup
        window.currentForm = null;
        window.autoFilledFields = null;
        
        // Return to comparison view
        editCardAreaEl.classList.add('hidden');
        comparisonAreaEl.classList.remove('hidden');
        
        // Update the card display with current state
        displayComparison(currentState.currentIndex);
        
        console.log('Card update complete');
    }
    
    // Detect actually changed fields, ignoring auto-filled nulls
    function detectActualChanges(original, edited) {
        const changes = [];
        const wasAutoFilled = {}; // Track which fields were auto-filled
        
        // First, identify fields that were auto-filled with nulls
        for (const key in edited) {
            if (!(key in original)) {
                // This field was probably auto-filled
                wasAutoFilled[key] = true;
            }
        }
        
        // Now detect actual changes, ignoring auto-filled fields unless they have real values
        for (const key in edited) {
            if (edited.hasOwnProperty(key) && key !== 'id') {
                const editedValue = edited[key];
                const originalValue = original[key];
                
                // Skip null/empty auto-filled fields
                if (wasAutoFilled[key] && 
                    (editedValue === null || editedValue === '' || 
                        (Array.isArray(editedValue) && editedValue.length === 0) ||
                        (typeof editedValue === 'object' && editedValue !== null && Object.keys(editedValue).length === 0))) {
                    continue;
                }
                
                // Check if the field actually changed
                if (JSON.stringify(originalValue) !== JSON.stringify(editedValue)) {
                    changes.push(key);
                }
            }
        }
        
        return changes;
    }

    function fillMissingRequiredFields(data, schema) {
        // Create a deep copy of the data to avoid modifying the original
        const filledData = JSON.parse(JSON.stringify(data));
        
        // Initialize or get the _autoFilledFields tracking object
        if (!filledData._autoFilledFields) {
            filledData._autoFilledFields = [];
        }
        
        // If the schema has required fields, ensure they exist in the data
        if (schema && schema.required && Array.isArray(schema.required)) {
            schema.required.forEach(fieldName => {
                if (!(fieldName in filledData)) {
                    // Initialize missing required field with appropriate null value
                    if (schema.properties && schema.properties[fieldName]) {
                        const propType = schema.properties[fieldName].type;
                        
                        // Initialize with appropriate empty value based on type
                        if (propType === 'string') {
                            filledData[fieldName] = '';
                        } else if (propType === 'array') {
                            filledData[fieldName] = [];
                        } else if (propType === 'object') {
                            filledData[fieldName] = {};
                        } else if (propType === 'number' || propType === 'integer') {
                            filledData[fieldName] = null;
                        } else if (propType === 'boolean') {
                            filledData[fieldName] = false;
                        } else {
                            filledData[fieldName] = null;
                        }
                        
                        // Track that this field was auto-filled
                        filledData._autoFilledFields.push(fieldName);
                        
                        console.log(`Initialized missing required field: ${fieldName}`);
                    } else {
                        // Default to null if type information is not available
                        filledData[fieldName] = null;
                        filledData._autoFilledFields.push(fieldName);
                    }
                }
            });
        }
        
        // Also handle nested objects
        if (schema && schema.properties) {
            Object.keys(schema.properties).forEach(propName => {
                const prop = schema.properties[propName];
                
                // If property is an object with its own properties, recursively process it
                if (prop.type === 'object' && prop.properties) {
                    // Make sure the property exists in data as an object
                    if (!filledData[propName] || typeof filledData[propName] !== 'object') {
                        filledData[propName] = {};
                        filledData._autoFilledFields.push(propName);
                    }
                    
                    // Recursively fill missing fields in the nested object
                    const nestedResult = fillMissingRequiredFields(filledData[propName], prop);
                    filledData[propName] = nestedResult;
                    
                    // Add nested auto-filled fields with proper path
                    if (nestedResult._autoFilledFields && nestedResult._autoFilledFields.length > 0) {
                        nestedResult._autoFilledFields.forEach(nestedField => {
                            filledData._autoFilledFields.push(`${propName}.${nestedField}`);
                        });
                    }
                    
                    // Remove the tracking property from the nested object
                    if (filledData[propName]._autoFilledFields) {
                        delete filledData[propName]._autoFilledFields;
                    }
                }
                
                // If property is an array of objects, process each item
                if (prop.type === 'array' && prop.items && prop.items.type === 'object') {
                    if (Array.isArray(filledData[propName])) {
                        filledData[propName] = filledData[propName].map((item, index) => {
                            const arrayItemResult = fillMissingRequiredFields(item, prop.items);
                            
                            // Add array item auto-filled fields with proper path
                            if (arrayItemResult._autoFilledFields && arrayItemResult._autoFilledFields.length > 0) {
                                arrayItemResult._autoFilledFields.forEach(arrayField => {
                                    filledData._autoFilledFields.push(`${propName}[${index}].${arrayField}`);
                                });
                            }
                            
                            // Remove the tracking property from the array item
                            if (arrayItemResult._autoFilledFields) {
                                delete arrayItemResult._autoFilledFields;
                            }
                            
                            return arrayItemResult;
                        });
                    }
                }
            });
        }
        
        return filledData;
    }
    
    
    // --- Rendering Functions ---
    // Updated renderCard function to skip null values
    function renderCard(cardData, displayIndex) {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        const minimal = isMinimalCard(cardData);
        let title = `<a href="https://www.synapse.org/Synapse:${cardData.id}">Dataset</a>`; 
        let attributesHtml = '<p><i>This failed validation.</i></p>';

        if (!minimal) {
            title = `<a href="https://www.synapse.org/Synapse:${cardData.id}">${cardData.title || 'Dataset'}</a>`; 
            attributesHtml = ''; // Reset for non-minimal cards
            
            // Get property order from schema
            const schemaPropertyOrder = getSchemaPropertyOrder();
            
            // First display properties in the schema-defined order
            if (schemaPropertyOrder.length > 0) {
                schemaPropertyOrder.forEach(key => {
                    if (cardData.hasOwnProperty(key) && 
                        key !== 'id' && 
                        key !== 'img' && 
                        key !== 'title' && 
                        !isEmptyValue(cardData[key])) { // Skip empty/null values
                        
                        const value = formatValue(cardData[key]);
                        attributesHtml += `<dt>${capitalize(key)}</dt><dd>${value}</dd>`;
                    }
                });
                
                // Then display any additional properties not in the schema
                for (const key in cardData) {
                    if (cardData.hasOwnProperty(key) && 
                        key !== 'id' && 
                        key !== 'title' && 
                        key !== 'img' && 
                        !schemaPropertyOrder.includes(key) && 
                        !isEmptyValue(cardData[key])) { // Skip empty/null values
                        
                        const value = formatValue(cardData[key]);
                        attributesHtml += `<dt>${capitalize(key)}</dt><dd>${value}</dd>`;
                    }
                }
            } else {
                // Fallback if schema properties are not available
                for (const key in cardData) {
                    if (cardData.hasOwnProperty(key) && 
                        key !== 'id' && 
                        key !== 'title' && 
                        key !== 'img' && 
                        !isEmptyValue(cardData[key])) { // Skip empty/null values
                        
                        const value = formatValue(cardData[key]);
                        attributesHtml += `<dt>${capitalize(key)}</dt><dd>${value}</dd>`;
                    }
                }
            }
            
            if (!attributesHtml) { // Handle case where there are no attributes
                attributesHtml = '<p><i>No additional attributes.</i></p>';
            }
        }

        const imgHtml = cardData.img ? `<img src="/img/${cardData.img}" alt="${cardData.name || 'Card Image'}">` : '';
        
        // Add edit button for non-minimal cards
        const editButtonHtml = !minimal ? 
            `<button class="edit-card-button" data-display-index="${displayIndex}">Edit</button>` : '';

        cardEl.innerHTML = `
            <h3>${title}</h3>
            ${imgHtml}
            <dl>
                ${attributesHtml}
            </dl>
            ${editButtonHtml}
        `;
        
        // Add click event for the edit button
        if (!minimal) {
            const editButton = cardEl.querySelector('.edit-card-button');
            if (editButton) {
                editButton.addEventListener('click', function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    // Log which card we're editing including its set
                    const setIndex = currentDisplayOrder[displayIndex].originalIndex;
                    console.log(`Edit button clicked for display index: ${displayIndex} (Set ${["A", "B", "C"][setIndex]})`);
                    console.log("Editing card:", currentDisplayOrder[displayIndex].card);
                    
                    // Clone the card data to prevent unintended mutations
                    const cardToEdit = JSON.parse(JSON.stringify(currentDisplayOrder[displayIndex].card));
                    
                    // Ensure the card has an ID
                    if (!cardToEdit.id) {
                        console.error("Card is missing ID");
                        alert("Error: Card is missing ID");
                        return;
                    }
                    
                    // Pass both the card data and display index to openEditForm
                    openEditForm(cardToEdit, displayIndex);
                });
            }
        }
        
        return cardEl;
    }

    // Helper function to check if a value is empty (null, undefined, empty string, empty array, or empty object)
    function isEmptyValue(value) {
        // Check for null or undefined
        if (value === null || value === undefined) {
            return true;
        }
        
        // Check for empty string
        if (typeof value === 'string' && value.trim() === '') {
            return true;
        }
        
        // Check for empty array
        if (Array.isArray(value) && value.length === 0) {
            return true;
        }
        
        // Check for empty object (no own enumerable properties)
        if (typeof value === 'object' && Object.keys(value).length === 0) {
            return true;
        }
        
        return false;
    }

    // Helper function to format different value types (not showing empty values)
    function formatValue(value) {
        if (isEmptyValue(value)) {
            return '';
        }
        
        if (Array.isArray(value)) {
            // Handle arrays of objects specially
            if (typeof value[0] === 'object' && value[0] !== null) {
                try {
                    return value
                        .filter(item => !isEmptyValue(item)) // Skip empty items
                        .map(item => {
                            if (typeof item === 'object') {
                                // Create a simplified string representation
                                return Object.entries(item)
                                    .filter(([k, v]) => !isEmptyValue(v)) // Skip empty values
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(', ');
                            }
                            return String(item);
                        })
                        .join('; ');
                } catch (e) {
                    return JSON.stringify(value);
                }
            }
            
            return value
                .filter(item => !isEmptyValue(item)) // Skip empty items
                .join(', ');
        }
        
        if (typeof value === 'object' && value !== null) {
            try {
                // Create a simplified string representation
                const entries = Object.entries(value)
                    .filter(([k, v]) => !isEmptyValue(v)); // Skip empty values
                    
                if (entries.length === 0) {
                    return '';
                }
                
                return entries
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(', ');
            } catch (e) {
                return JSON.stringify(value);
            }
        }
        
        return String(value);
    }

    // Helper function to get property order from the schema
    function getSchemaPropertyOrder() {
        if (!jsonSchema || !jsonSchema.properties) {
            return [];
        }
        
        // Get property order from schema
        // First check if there's an explicit order
        if (jsonSchema.propertyOrder) {
            return jsonSchema.propertyOrder;
        }
        
        // Otherwise, use the order properties are defined in the schema
        return Object.keys(jsonSchema.properties);
    }

    function displayComparison(index) {
        // Guard against running if data isn't ready
        if (!dataIsValid) {
            console.error("displayComparison called before data is ready.");
            return;
        }

        console.log(`displayComparison: Called with index ${index}. Total comparisons: ${totalComparisons}`);
        if (index >= 0 && index < totalComparisons) {
            statusMessageEl.textContent = `Comparing ${index + 1} of ${totalComparisons}`;
            submitStatusEl.textContent = ""; // Clear any previous submission status
            cardContainerEl.innerHTML = '';
            scoringFormEl.reset();
            validationErrorEl.classList.add('hidden');
            validationErrorEl.textContent = '';

            // Update navigation input
            gotoIndexInput.value = index + 1;

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
                const cardElement = renderCard(item.card, displayIndex);
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

            // Reset changedFields when displaying a new comparison
            changedFields = [];
            
            // Hide edit area and show comparison area
            editCardAreaEl.classList.add('hidden');
            comparisonAreaEl.classList.remove('hidden');
            completionAreaEl.classList.add('hidden');
            navigationAreaEl.classList.remove('hidden');
            controlsAreaEl.classList.remove('hidden'); // Show controls when comparison starts
            if (scoreInputs[0]) scoreInputs[0].focus();

        } else {
            displayCompletion();
            // Ensure controls are visible on completion too
            controlsAreaEl.classList.remove('hidden');
        }
    }

    function displayCompletion() {
        statusMessageEl.textContent = "All comparisons complete!";
        comparisonAreaEl.classList.add('hidden');
        editCardAreaEl.classList.add('hidden');
        completionAreaEl.classList.remove('hidden');
        navigationAreaEl.classList.remove('hidden');
        updateResultsCount(); // Update results count
    }

    // --- Event Handlers ---
    async function handleScoreSubmit(event) {
        event.preventDefault();
        
        if (isSubmitting) {
            return; // Prevent multiple submissions
        }
    
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
    
        // Get notes from the textarea
        const notesText = document.getElementById('notes').value.trim();
    
        // Record results, mapping scores back to original A, B, C
        const currentIndex = currentState.currentIndex;
        const result = {
            user: username,
            comparisonIndex: currentIndex,
            cardA: cardSets[0][currentIndex], // Original card A data
            cardB: cardSets[1][currentIndex], // Original card B data
            cardC: cardSets[2][currentIndex], // Original card C data
            scoreA: scores[0],              // Score given to original card A
            scoreB: scores[1],              // Score given to original card B
            scoreC: scores[2],              // Score given to original card C
            notes: notesText,               // Notes from the textarea
            timestamp: new Date().toISOString(),
            changed: changedFields.length > 0 ? changedFields : undefined // Add changed fields if any
        };
        
        // Disable form during submission
        isSubmitting = true;
        const submitButton = scoringFormEl.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.textContent = "Submitting...";
        submitButton.disabled = true;
        
        // Submit this single result to the server
        try {
            submitStatusEl.textContent = "Submitting...";
            submitStatusEl.style.color = 'blue';
            
            const success = await sendScoreData([result]); // Send just this one result
            
            if (success) {
                // Add to local results
                currentState.results.push(result);

                // Find the highest-scoring card and submit it
                submitStatusEl.textContent = "Submitting highest-scoring card...";
                const highestCard = getHighestScoringCard(scores, currentIndex);
                
                if (highestCard) {
                    try {
                        await submitCardData(highestCard.card, apiKey);
                        submitStatusEl.textContent = "All submitted successfully!";
                        submitStatusEl.style.color = 'green';
                    } catch (cardError) {
                        console.error("Error submitting card data:", cardError);
                        submitStatusEl.textContent = "Scores submitted, but applying card data failed.";
                        submitStatusEl.style.color = 'orange';
                    }
                } else {
                    submitStatusEl.textContent = "Scores submitted, but no valid highest card found.";
                    submitStatusEl.style.color = 'orange';
                }
                
                // Reset changedFields for the next comparison
                changedFields = [];
                
                // Advance to next comparison
                currentState.currentIndex++;
                saveState();
                displayComparison(currentState.currentIndex);
            } else {
                submitStatusEl.textContent = "Submission failed. Please try again.";
                submitStatusEl.style.color = 'red';
            }
        } catch (error) {
            console.error("Error submitting data:", error);
            submitStatusEl.textContent = "Error submitting data. Please try again.";
            submitStatusEl.style.color = 'red';
        } finally {
            // Re-enable form
            isSubmitting = false;
            submitButton.textContent = originalButtonText;
            submitButton.disabled = false;
        }
    }

    async function sendScoreData(data) {
        try {
          const response = await fetch(POST_ENDPOINT_URL, {
            method: 'POST',
            mode: 'no-cors', // Prevents CORS errors but makes response unreadable
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
          });
          
          console.log('Request sent, but response is opaque due to no-cors mode');
          return true;
        } catch (error) {
          console.error('Error:', error);
          return false;
        }
    }
    
    function handleGotoIndex() {
        if (!dataIsValid) return;
        
        const targetIndex = parseInt(gotoIndexInput.value, 10) - 1; // Convert from 1-based to 0-based
        
        if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= totalComparisons) {
            alert(`Please enter a valid comparison number between 1 and ${totalComparisons}.`);
            return;
        }
        
        currentState.currentIndex = targetIndex;
        saveState();
        displayComparison(currentState.currentIndex);
    }
    
    // --- Event handlers for card editing ---
    function handleBackToComparison() {
        // Discard changes and return to comparison view
        window.currentForm = null;
        window.autoFilledFields = null;

        editCardAreaEl.classList.add('hidden');
        comparisonAreaEl.classList.remove('hidden');
    }

    // --- Data Loading ---
    async function loadDataFromUrl(url) {
        const enteredApiKey = apiKeyInput.value.trim();
        if (!enteredApiKey) {
            loadStatusMessageEl.textContent = "Please enter a Synapse API key.";
            loadStatusMessageEl.style.color = 'red';
            return;
        }
        
        loadDataButton.disabled = true;
        loadStatusMessageEl.textContent = "Loading data...";
        loadStatusMessageEl.style.color = 'blue';
        
        // Validate the API key with Synapse
        const validation = await validateApiKey(enteredApiKey);
        
        if (!validation.valid) {
            loadStatusMessageEl.textContent = `API key validation failed: ${validation.error}`;
            loadStatusMessageEl.style.color = 'red';
            loadDataButton.disabled = false;
            return;
        }
        
        // Store the API key and username
        apiKey = enteredApiKey;
        username = validation.username;

        loadStatusMessageEl.textContent = `Welcome, ${username}. Loading schema...`;
        loadStatusMessageEl.style.color = 'blue';
        
        // Load the JSON schema for the form first
        try {
            const schemaLoaded = await loadJsonSchema();
            
            if (!schemaLoaded) {
                throw new Error("Failed to load schema. Please try again.");
            }
            
            loadStatusMessageEl.textContent = `Schema loaded. Loading dataset data...`;
            dataIsValid = false; // Assume invalid until successfully loaded

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

            // Save API key and username to localStorage
            localStorage.setItem(STORAGE_KEY_USERNAME, username);
            
            loadStatusMessageEl.textContent = `Successfully loaded ${totalComparisons} comparison sets.`;
            loadStatusMessageEl.style.color = 'green';

            // Hide loading UI, show main app
            loadDataAreaEl.classList.add('hidden');
            mainAppAreaEl.classList.remove('hidden');

            // Set max value for goto index input
            if (gotoIndexInput) {
                gotoIndexInput.max = totalComparisons;
                gotoIndexInput.value = 1; // Start at first comparison
            }

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

        if (!scoringFormEl.dataset.listenerAttached) {
            scoringFormEl.addEventListener('submit', handleScoreSubmit);
            resetButton.addEventListener('click', resetState);
            gotoButton.addEventListener('click', handleGotoIndex);
            scoringFormEl.dataset.listenerAttached = 'true'; // Mark as attached
        }

        if (backToComparisonBtn) {
            // Remove any existing listeners to prevent duplicates
            backToComparisonBtn.removeEventListener('click', handleBackToComparison);
            backToComparisonBtn.addEventListener('click', handleBackToComparison);
        }
        
        if (saveCardChangesBtn) {
            saveCardChangesBtn.removeEventListener('click', saveCardChanges);
            saveCardChangesBtn.addEventListener('click', saveCardChanges);
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
