/**
 * A simple form generator using vanilla JavaScript
 * No dependencies required
 */

// Function to generate a form from JSON Schema
function generateFormFromSchema(schema, data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container element not found: ${containerId}`);
        return null;
    }
    
    // Clear the container
    container.innerHTML = '';
    
    // Create form element
    const form = document.createElement('form');
    form.className = 'schema-form';
    form.setAttribute('novalidate', 'novalidate');
    
    // Make sure data is a valid object
    if (!data || typeof data !== 'object') {
        console.warn('Invalid data provided to form generator. Using empty object.');
        data = {};
    }
    
    // Add form contents based on schema
    if (schema && schema.properties) {
        // Track the form fields and their paths for later data extraction
        const formFields = [];
        
        // Process each property in the schema
        Object.keys(schema.properties).forEach(key => {
            try {
                const fieldset = createFieldForProperty(key, schema.properties[key], data[key], '', formFields);
                if (fieldset && fieldset instanceof Node) {
                    form.appendChild(fieldset);
                } else {
                    console.error(`Invalid fieldset created for ${key}:`, fieldset);
                }
            } catch (error) {
                console.error(`Error creating field for ${key}:`, error);
                // Continue with other fields
            }
        });
        
        // Store the fields data for later retrieval
        try {
            form.dataset.formFields = JSON.stringify(formFields);
        } catch (error) {
            console.error('Error storing form fields data:', error);
            // Create a simplified version that can be serialized
            const simplifiedFields = formFields.map(field => ({
                path: field.path,
                type: field.type,
                element: field.element
            }));
            form.dataset.formFields = JSON.stringify(simplifiedFields);
        }
    } else {
        console.error('Invalid schema or missing properties:', schema);
        const errorMessage = document.createElement('p');
        errorMessage.className = 'error-message';
        errorMessage.textContent = 'Error: Invalid schema provided. Unable to generate form.';
        form.appendChild(errorMessage);
    }
    
    // Append the form to the container
    container.appendChild(form);
    
    return form;
}

// Create a field based on property type
function createFieldForProperty(key, property, value, path, formFields) {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'form-field';
    
    // Create label
    const label = document.createElement('label');
    label.textContent = property.title || key;
    if (property.required) {
        label.classList.add('required');
    }
    fieldset.appendChild(label);
    
    // Update the current path
    const currentPath = path ? `${path}.${key}` : key;
    
    // Check if this is a multivalued enum
    const isMultivaluedEnum = property.type === 'array' && 
                              property.items && 
                              property.items.type === 'string' && 
                              property.items.enum;
    
    // Create input based on property type
    let input;
    
    if (isMultivaluedEnum) {
        // Special handling for array of enums (multivalued enum)
        input = document.createElement('div');
        input.className = 'multivalued-enum-container';
        
        // Container for the selected values
        const selectedValuesContainer = document.createElement('div');
        selectedValuesContainer.className = 'selected-values';
        selectedValuesContainer.id = `${key}-selected-values`;
        
        // Display existing values
        const currentValues = Array.isArray(value) ? value : [];
        currentValues.forEach((val, index) => {
            const valueItem = document.createElement('div');
            valueItem.className = 'selected-value-item';
            valueItem.dataset.value = val;
            
            const valueText = document.createElement('span');
            valueText.textContent = val;
            valueItem.appendChild(valueText);
            
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove-value-btn';
            removeBtn.textContent = '×';
            removeBtn.onclick = function() {
                valueItem.remove();
                // Create hidden input for tracking
                updateHiddenInputs(key, currentPath, selectedValuesContainer, formFields);
            };
            valueItem.appendChild(removeBtn);
            
            selectedValuesContainer.appendChild(valueItem);
        });
        
        input.appendChild(selectedValuesContainer);
        
        // Dropdown for selecting new values
        const selectContainer = document.createElement('div');
        selectContainer.className = 'enum-select-container';
        
        const select = document.createElement('select');
        select.id = `${key}-selector`;
        select.className = 'enum-selector';
        
        // Add empty option as the default
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '-- Select to add --';
        select.appendChild(emptyOption);
        
        // Add enum options, excluding already selected values
        property.items.enum.forEach(option => {
            if (!currentValues.includes(option)) {
                const optionElement = document.createElement('option');
                optionElement.value = option;
                optionElement.textContent = option;
                select.appendChild(optionElement);
            }
        });
        
        // Add button
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'add-enum-value-btn';
        addBtn.textContent = 'Add';
        addBtn.onclick = function() {
            const selectedValue = select.value;
            if (selectedValue) {
                // Add the selected value
                const valueItem = document.createElement('div');
                valueItem.className = 'selected-value-item';
                valueItem.dataset.value = selectedValue;
                
                const valueText = document.createElement('span');
                valueText.textContent = selectedValue;
                valueItem.appendChild(valueText);
                
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'remove-value-btn';
                removeBtn.textContent = '×';
                removeBtn.onclick = function() {
                    valueItem.remove();
                    
                    // Add the option back to the dropdown
                    const optionElement = document.createElement('option');
                    optionElement.value = selectedValue;
                    optionElement.textContent = selectedValue;
                    select.appendChild(optionElement);
                    
                    // Re-sort options alphabetically
                    sortSelectOptions(select);
                    
                    // Update hidden inputs
                    updateHiddenInputs(key, currentPath, selectedValuesContainer, formFields);
                };
                valueItem.appendChild(removeBtn);
                
                selectedValuesContainer.appendChild(valueItem);
                
                // Remove the selected option from the dropdown
                for (let i = 0; i < select.options.length; i++) {
                    if (select.options[i].value === selectedValue) {
                        select.remove(i);
                        break;
                    }
                }
                
                // Reset the dropdown
                select.value = '';
                
                // Update hidden inputs
                updateHiddenInputs(key, currentPath, selectedValuesContainer, formFields);
            }
        };
        
        selectContainer.appendChild(select);
        selectContainer.appendChild(addBtn);
        input.appendChild(selectContainer);
        
        // Create hidden inputs to store the values for form submission
        updateHiddenInputs(key, currentPath, selectedValuesContainer, formFields);
        
    } else if (property.type === 'string') {
        // Standard string handling
        if (property.enum) {
            // Create a select dropdown for enum values
            input = document.createElement('select');
            input.id = key;
            input.name = key;
            
            // Add empty option if not required
            if (!property.required) {
                const emptyOption = document.createElement('option');
                emptyOption.value = '';
                emptyOption.textContent = '-- Select --';
                input.appendChild(emptyOption);
            }
            
            // Add enum options
            property.enum.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option;
                optionElement.textContent = option;
                if (value === option) {
                    optionElement.selected = true;
                }
                input.appendChild(optionElement);
            });
        } else if (property.format === 'date') {
            // Date input
            input = document.createElement('input');
            input.type = 'date';
            input.id = key;
            input.name = key;
            input.value = value || '';
        } else if (key.toLowerCase().includes('description')) {
            // Textarea for descriptions
            input = document.createElement('textarea');
            input.id = key;
            input.name = key;
            input.rows = 3;
            input.value = value || '';
        } else {
            // Regular text input
            input = document.createElement('input');
            input.type = 'text';
            input.id = key;
            input.name = key;
            input.value = value || '';
        }
    } else if (property.type === 'number' || property.type === 'integer') {
        input = document.createElement('input');
        input.type = 'number';
        input.id = key;
        input.name = key;
        input.value = value !== undefined && value !== null ? value : '';
        if (property.minimum !== undefined) {
            input.min = property.minimum;
        }
        if (property.maximum !== undefined) {
            input.max = property.maximum;
        }
    } else if (property.type === 'boolean') {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.id = key;
        input.name = key;
        input.checked = value === true;
    } else if (property.type === 'array' && !isMultivaluedEnum) {
        // Standard array handling (not enum array)
        input = document.createElement('div');
        input.className = 'array-container';
        input.id = `${key}-container`;
        
        // Create items container
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'array-items';
        itemsContainer.id = `${key}-items`;
        
        // Add existing array items
        if (Array.isArray(value)) {
            value.forEach((item, index) => {
                // Create a simple array item container
                const itemContainer = document.createElement('div');
                itemContainer.className = 'array-item';
                itemContainer.dataset.arrayIndex = index.toString();
                
                let itemField;
                
                // Create field for the item
                if (property.items && property.items.type === 'object' && property.items.properties) {
                    // Object array item
                    const itemPath = `${currentPath}[${index}]`;
                    
                    // Process each property of the object
                    Object.keys(property.items.properties).forEach(propKey => {
                        try {
                            const propField = createFieldForProperty(
                                propKey, 
                                property.items.properties[propKey], 
                                item ? item[propKey] : null, 
                                itemPath,
                                formFields
                            );
                            
                            if (propField) {
                                itemContainer.appendChild(propField);
                            }
                        } catch (err) {
                            console.error(`Error creating field for ${propKey} in array item:`, err);
                        }
                    });
                } else if (property.items) {
                    // Simple array item (string, number, etc.)
                    try {
                        // Create a container for the simple item
                        const simpleContainer = document.createElement('div');
                        simpleContainer.className = 'simple-array-item';
                        
                        // Create the input element based on the item type
                        const inputId = `${key}-${index}`;
                        let itemInput;
                        
                        switch (property.items.type) {
                            case 'string':
                                itemInput = document.createElement('input');
                                itemInput.type = 'text';
                                itemInput.id = inputId;
                                itemInput.name = inputId;
                                itemInput.value = item || '';
                                break;
                            case 'number':
                            case 'integer':
                                itemInput = document.createElement('input');
                                itemInput.type = 'number';
                                itemInput.id = inputId;
                                itemInput.name = inputId;
                                itemInput.value = item !== undefined && item !== null ? item : '';
                                break;
                            case 'boolean':
                                itemInput = document.createElement('input');
                                itemInput.type = 'checkbox';
                                itemInput.id = inputId;
                                itemInput.name = inputId;
                                itemInput.checked = item === true;
                                break;
                            default:
                                itemInput = document.createElement('input');
                                itemInput.type = 'text';
                                itemInput.id = inputId;
                                itemInput.name = inputId;
                                itemInput.value = item || '';
                        }
                        
                        simpleContainer.appendChild(itemInput);
                        itemContainer.appendChild(simpleContainer);
                        
                        // Track this field
                        formFields.push({
                            path: `${currentPath}[${index}]`,
                            type: property.items.type,
                            element: inputId
                        });
                    } catch (err) {
                        console.error('Error creating simple array item:', err);
                    }
                }
                
                // Add remove button
                const removeButton = document.createElement('button');
                removeButton.type = 'button';
                removeButton.className = 'remove-item-btn';
                removeButton.textContent = 'Remove';
                removeButton.onclick = function() {
                    itemContainer.remove();
                    updateArrayIndices(key);
                };
                itemContainer.appendChild(removeButton);
                
                // Add the item container to the items container
                itemsContainer.appendChild(itemContainer);
            });
        }
        
        input.appendChild(itemsContainer);
        
        // Add button
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'add-item-btn';
        addButton.textContent = 'Add Item';
        addButton.onclick = function() {
            const itemCount = itemsContainer.children.length;
            
            // Create a new item container
            const itemContainer = document.createElement('div');
            itemContainer.className = 'array-item';
            itemContainer.dataset.arrayIndex = itemCount.toString();
            
            if (property.items && property.items.type === 'object' && property.items.properties) {
                // Object array item
                const itemPath = `${currentPath}[${itemCount}]`;
                
                // Process each property of the object
                Object.keys(property.items.properties).forEach(propKey => {
                    try {
                        const propField = createFieldForProperty(
                            propKey, 
                            property.items.properties[propKey], 
                            null, 
                            itemPath,
                            formFields
                        );
                        
                        if (propField) {
                            itemContainer.appendChild(propField);
                        }
                    } catch (err) {
                        console.error(`Error creating field for ${propKey} in new array item:`, err);
                    }
                });
            } else if (property.items) {
                // Simple array item
                try {
                    // Create a container for the simple item
                    const simpleContainer = document.createElement('div');
                    simpleContainer.className = 'simple-array-item';
                    
                    // Create the input element
                    const inputId = `${key}-${itemCount}`;
                    let itemInput;
                    
                    switch (property.items.type) {
                        case 'string':
                            itemInput = document.createElement('input');
                            itemInput.type = 'text';
                            itemInput.id = inputId;
                            itemInput.name = inputId;
                            itemInput.value = '';
                            break;
                        case 'number':
                        case 'integer':
                            itemInput = document.createElement('input');
                            itemInput.type = 'number';
                            itemInput.id = inputId;
                            itemInput.name = inputId;
                            itemInput.value = '';
                            break;
                        case 'boolean':
                            itemInput = document.createElement('input');
                            itemInput.type = 'checkbox';
                            itemInput.id = inputId;
                            itemInput.name = inputId;
                            itemInput.checked = false;
                            break;
                        default:
                            itemInput = document.createElement('input');
                            itemInput.type = 'text';
                            itemInput.id = inputId;
                            itemInput.name = inputId;
                            itemInput.value = '';
                    }
                    
                    simpleContainer.appendChild(itemInput);
                    itemContainer.appendChild(simpleContainer);
                    
                    // Track this field
                    formFields.push({
                        path: `${currentPath}[${itemCount}]`,
                        type: property.items.type,
                        element: inputId
                    });
                } catch (err) {
                    console.error('Error creating new simple array item:', err);
                }
            }
            
            // Add remove button
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'remove-item-btn';
            removeButton.textContent = 'Remove';
            removeButton.onclick = function() {
                itemContainer.remove();
                updateArrayIndices(key);
            };
            itemContainer.appendChild(removeButton);
            
            // Add the item container to the items container
            itemsContainer.appendChild(itemContainer);
        };
        input.appendChild(addButton);
    } else if (property.type === 'object') {
        // Create object container
        input = document.createElement('fieldset');
        input.className = 'object-container';
        
        // Add legend if title exists
        if (property.title) {
            const legend = document.createElement('legend');
            legend.textContent = property.title;
            input.appendChild(legend);
        }
        
        // Process object properties
        if (property.properties) {
            const objValue = value || {};
            
            // Ensure objValue is an object
            if (typeof objValue !== 'object' || objValue === null) {
                console.warn(`Expected object for ${key}, got ${typeof objValue}. Using empty object instead.`);
                objValue = {};
            }
            
            Object.keys(property.properties).forEach(propKey => {
                try {
                    const propField = createFieldForProperty(
                        propKey, 
                        property.properties[propKey], 
                        objValue[propKey], 
                        currentPath,
                        formFields
                    );
                    
                    if (propField) {
                        input.appendChild(propField);
                    }
                } catch (err) {
                    console.error(`Error creating field for ${propKey} in object ${key}:`, err);
                }
            });
        }
    } else {
        // Fallback to text input for unknown types
        input = document.createElement('input');
        input.type = 'text';
        input.id = key;
        input.name = key;
        input.value = value || '';
    }
    
    // Add input to fieldset
    if (input && input instanceof Node) {
        fieldset.appendChild(input);
        
        // Track this field for later data extraction unless it's a multivalued enum
        // (multivalued enums are tracked via hidden inputs)
        if (!isMultivaluedEnum && property.type !== 'array' && property.type !== 'object') {
            formFields.push({
                path: currentPath,
                type: property.type,
                element: input.id
            });
        }
    } else {
        console.error(`Invalid input created for ${key}:`, input);
    }
    
    return fieldset;
}

// Helper function to sort select options
function sortSelectOptions(select) {
    const options = Array.from(select.options);
    
    // Keep the empty option at the top
    const emptyOption = options.find(option => option.value === '');
    const nonEmptyOptions = options.filter(option => option.value !== '');
    
    // Sort non-empty options alphabetically
    nonEmptyOptions.sort((a, b) => a.text.localeCompare(b.text));
    
    // Clear select
    select.innerHTML = '';
    
    // Add empty option first if it exists
    if (emptyOption) {
        select.appendChild(emptyOption);
    }
    
    // Add sorted options
    nonEmptyOptions.forEach(option => select.appendChild(option));
}

// Helper function to update hidden inputs for multivalued enums
function updateHiddenInputs(key, path, container, formFields) {
    // Remove old hidden inputs for this field
    const oldInputs = document.querySelectorAll(`[id^="${key}-hidden-"]`);
    oldInputs.forEach(input => input.remove());
    
    // Remove old form field entries
    const formFieldIndex = formFields.findIndex(field => {
        return field.path === path || field.path.startsWith(`${path}[`);
    });
    
    if (formFieldIndex !== -1) {
        formFields.splice(formFieldIndex, 1);
    }
    
    // Get all selected values
    const selectedItems = container.querySelectorAll('.selected-value-item');
    const values = Array.from(selectedItems).map(item => item.dataset.value);
    
    // Create a single hidden input with a JSON string of all values
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.id = `${key}-hidden-values`;
    hiddenInput.name = `${key}-values`;
    hiddenInput.value = JSON.stringify(values);
    container.appendChild(hiddenInput);
    
    // Add to form fields for extraction
    formFields.push({
        path: path,
        type: 'array',
        element: hiddenInput.id,
        isMultivaluedEnum: true
    });
}

// Function to update array indices after removing items
function updateArrayIndices(containerKey) {
    const container = document.getElementById(`${containerKey}-items`);
    if (!container) return;
    
    // Update the data-array-index attribute and IDs/names of all input elements
    const items = container.querySelectorAll('.array-item');
    items.forEach((item, newIndex) => {
        const oldIndex = parseInt(item.dataset.arrayIndex, 10);
        item.dataset.arrayIndex = newIndex.toString();
        
        // Update all input elements within this item
        const inputs = item.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            // Replace the old index with the new index in the ID and name
            const oldId = input.id;
            const oldName = input.name;
            const newId = oldId.replace(`-${oldIndex}`, `-${newIndex}`);
            const newName = oldName.replace(`-${oldIndex}`, `-${newIndex}`);
            
            input.id = newId;
            input.name = newName;
            
            // Update any references in the formFields array
            const formFields = JSON.parse(document.querySelector('.schema-form').dataset.formFields || '[]');
            for (let i = 0; i < formFields.length; i++) {
                if (formFields[i].element === oldId) {
                    formFields[i].element = newId;
                    // Update the path too if needed
                    formFields[i].path = formFields[i].path.replace(`[${oldIndex}]`, `[${newIndex}]`);
                }
            }
            document.querySelector('.schema-form').dataset.formFields = JSON.stringify(formFields);
        });
    });
}

// Helper function to create a simple array item
function createSimpleArrayItem(key, itemSchema, value, index) {
    const container = document.createElement('div');
    container.className = 'simple-array-item';
    container.dataset.arrayIndex = index.toString();
    
    let input;
    const inputId = `${key}-${index}`;
    
    // Create input based on item type
    switch (itemSchema.type) {
        case 'string':
            if (itemSchema.enum) {
                // Create a select dropdown for enum values
                input = document.createElement('select');
                input.id = inputId;
                input.name = inputId;
                
                // Add empty option if not required
                if (!itemSchema.required) {
                    const emptyOption = document.createElement('option');
                    emptyOption.value = '';
                    emptyOption.textContent = '-- Select --';
                    input.appendChild(emptyOption);
                }
                
                // Add enum options
                itemSchema.enum.forEach(option => {
                    const optionElement = document.createElement('option');
                    optionElement.value = option;
                    optionElement.textContent = option;
                    if (value === option) {
                        optionElement.selected = true;
                    }
                    input.appendChild(optionElement);
                });
            } else {
                // Regular text input
                input = document.createElement('input');
                input.type = 'text';
                input.id = inputId;
                input.name = inputId;
                input.value = value || '';
            }
            break;
            
        case 'number':
        case 'integer':
            input = document.createElement('input');
            input.type = 'number';
            input.id = inputId;
            input.name = inputId;
            input.value = value !== undefined && value !== null ? value : '';
            break;
            
        case 'boolean':
            input = document.createElement('input');
            input.type = 'checkbox';
            input.id = inputId;
            input.name = inputId;
            input.checked = value === true;
            break;
            
        default:
            // Fallback to text input
            input = document.createElement('input');
            input.type = 'text';
            input.id = inputId;
            input.name = inputId;
            input.value = value || '';
    }
    
    container.appendChild(input);
    return container;
}

// Function to extract data from the form
function extractFormData(form) {
    if (!form || !form.dataset.formFields) {
        console.error('Invalid form or missing field data');
        return null;
    }
    
    try {
        const formFields = JSON.parse(form.dataset.formFields);
        const data = {};
        const arrayIndices = {};

        // First pass: Collect valid elements and rebuild array indices
        const validElements = [];
        
        formFields.forEach(field => {
            const element = document.getElementById(field.element);
            if (!element) {
                // This might be a removed array element, check if it's part of an array
                const arrayMatch = field.path.match(/^(.*)\[(\d+)\](.*)$/);
                if (arrayMatch) {
                    const arrayPath = arrayMatch[1];
                    // Skip this field, it's a removed array element
                    console.log(`Skipping removed array element: ${field.path}`);
                    
                    // Make sure the array exists in our tracking object
                    if (!arrayIndices[arrayPath]) {
                        arrayIndices[arrayPath] = {
                            indices: {},
                            maxIndex: -1
                        };
                    }
                } else {
                    console.warn(`Element not found and not an array element: ${field.element} (path: ${field.path})`);
                }
                return;
            }
            
            // Check if this is an array element
            const arrayMatch = field.path.match(/^(.*)\[(\d+)\](.*)$/);
            if (arrayMatch) {
                const arrayPath = arrayMatch[1];
                const index = parseInt(arrayMatch[2], 10);
                
                // Track this array's indices
                if (!arrayIndices[arrayPath]) {
                    arrayIndices[arrayPath] = {
                        indices: {},
                        maxIndex: -1
                    };
                }
                
                arrayIndices[arrayPath].indices[index] = true;
                arrayIndices[arrayPath].maxIndex = Math.max(arrayIndices[arrayPath].maxIndex, index);
            }
            
            validElements.push(field);
        });
        
        // Create a mapping of old indices to new indices for each array
        const indexMappings = {};
        for (const arrayPath in arrayIndices) {
            indexMappings[arrayPath] = {};
            let newIndex = 0;
            
            // For each possible index up to the max found index
            for (let i = 0; i <= arrayIndices[arrayPath].maxIndex; i++) {
                if (arrayIndices[arrayPath].indices[i]) {
                    // This index exists, map it to the next available new index
                    indexMappings[arrayPath][i] = newIndex++;
                }
            }
        }
        
        // Second pass: Extract values with corrected array indices
        validElements.forEach(field => {
            const element = document.getElementById(field.element);
            
            // Special handling for multivalued enums
            if (field.isMultivaluedEnum) {
                try {
                    // Get the JSON array from the hidden input
                    const values = JSON.parse(element.value || '[]');
                    setValueAtPath(data, field.path, values);
                    return;
                } catch (error) {
                    console.error('Error parsing multivalued enum values:', error);
                    setValueAtPath(data, field.path, []);
                    return;
                }
            }
            
            // Get value based on element type
            let value;
            if (element.type === 'checkbox') {
                value = element.checked;
            } else if (element.type === 'number') {
                value = element.value === '' ? null : Number(element.value);
            } else {
                value = element.value;
            }
            
            // Check if this is an array element that needs index remapping
            let path = field.path;
            const arrayMatch = path.match(/^(.*)\[(\d+)\](.*)$/);
            if (arrayMatch) {
                const arrayPath = arrayMatch[1];
                const oldIndex = parseInt(arrayMatch[2], 10);
                const rest = arrayMatch[3];
                
                // Use the new index from our mapping
                const newIndex = indexMappings[arrayPath][oldIndex];
                
                // Reconstruct the path with the new index
                path = `${arrayPath}[${newIndex}]${rest}`;
            }
            
            // Set the value in the data object at the correct path
            setValueAtPath(data, path, value);
        });
        
        return data;
    } catch (error) {
        console.error('Error extracting form data:', error);
        return null;
    }
}

// Update the function that creates the array container to handle reindexing
function createArrayItem(key, property, itemSchema, value, index, currentPath, formFields) {
    const itemContainer = document.createElement('div');
    itemContainer.className = 'array-item';
    itemContainer.dataset.arrayIndex = index.toString();
    
    // The item path for this array element
    const itemPath = `${currentPath}[${index}]`;
    
    // Create field for the item
    if (itemSchema.type === 'object') {
        // Object array item
        Object.keys(itemSchema.properties).forEach(propKey => {
            const itemValue = value ? value[propKey] : null;
            const itemField = createFieldForProperty(
                propKey, 
                itemSchema.properties[propKey], 
                itemValue, 
                itemPath,
                formFields
            );
            itemContainer.appendChild(itemField);
        });
    } else {
        // Simple array item
        const itemField = createSimpleArrayItem(key, itemSchema, value, index);
        itemContainer.appendChild(itemField);
        
        // Track this field
        formFields.push({
            path: itemPath,
            type: itemSchema.type,
            element: itemField.querySelector('input, select, textarea').id
        });
    }
    
    // Add remove button
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'remove-item-btn';
    removeButton.textContent = 'Remove';
    removeButton.onclick = function() {
        // Remove this item and fix the remaining indices
        itemContainer.remove();
        updateArrayIndices(key);
    };
    itemContainer.appendChild(removeButton);
    
    return itemContainer;
}

// Function to update array indices after removing items
function updateArrayIndices(containerKey) {
    const container = document.getElementById(`${containerKey}-items`);
    if (!container) return;
    
    // Update the data-array-index attribute and IDs/names of all input elements
    const items = container.querySelectorAll('.array-item');
    items.forEach((item, newIndex) => {
        const oldIndex = parseInt(item.dataset.arrayIndex, 10);
        item.dataset.arrayIndex = newIndex.toString();
        
        // Update all input elements within this item
        const inputs = item.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            // Replace the old index with the new index in the ID and name
            const oldId = input.id;
            const oldName = input.name;
            const newId = oldId.replace(`-${oldIndex}`, `-${newIndex}`);
            const newName = oldName.replace(`-${oldIndex}`, `-${newIndex}`);
            
            input.id = newId;
            input.name = newName;
        });
    });
}

// Helper function to set a value at a specific path in an object
function setValueAtPath(obj, path, value) {
    // Handle array paths like 'key[0].property'
    const arrayMatch = path.match(/^(.*)\[(\d+)\](.*)$/);
    if (arrayMatch) {
        const arrayPath = arrayMatch[1];
        const index = parseInt(arrayMatch[2], 10);
        const rest = arrayMatch[3];
        
        // Make sure the array exists
        if (!obj[arrayPath]) {
            obj[arrayPath] = [];
        }
        
        // Ensure array has enough elements
        while (obj[arrayPath].length <= index) {
            obj[arrayPath].push({});
        }
        
        if (rest) {
            // There's more to the path after the array index
            setValueAtPath(obj[arrayPath][index], rest.substring(1), value);
        } else {
            // This is a direct array element
            obj[arrayPath][index] = value;
        }
        return;
    }
    
    // Handle regular object paths like 'parent.child'
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
            current[part] = {};
        }
        current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
}