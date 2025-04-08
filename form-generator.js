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
    
    // Add form contents based on schema
    if (schema.properties) {
        // Track the form fields and their paths for later data extraction
        const formFields = [];
        
        // Process each property in the schema
        Object.keys(schema.properties).forEach(key => {
            const fieldset = createFieldForProperty(key, schema.properties[key], data[key], '', formFields);
            form.appendChild(fieldset);
        });
        
        // Store the fields data for later retrieval
        form.dataset.formFields = JSON.stringify(formFields);
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
    
    // Create input based on property type
    let input;
    
    switch (property.type) {
        case 'string':
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
            break;
            
        case 'number':
        case 'integer':
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
            break;
            
        case 'boolean':
            input = document.createElement('input');
            input.type = 'checkbox';
            input.id = key;
            input.name = key;
            input.checked = value === true;
            break;
            
        case 'array':
            // Create array container
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
                    const itemContainer = document.createElement('div');
                    itemContainer.className = 'array-item';
                    
                    // Create field for the item
                    if (property.items.type === 'object') {
                        // Object array item
                        const itemPath = `${currentPath}[${index}]`;
                        Object.keys(property.items.properties).forEach(propKey => {
                            const itemField = createFieldForProperty(
                                propKey, 
                                property.items.properties[propKey], 
                                item[propKey], 
                                itemPath,
                                formFields
                            );
                            itemContainer.appendChild(itemField);
                        });
                    } else {
                        // Simple array item
                        const itemField = createSimpleArrayItem(key, property.items, item, index);
                        itemContainer.appendChild(itemField);
                        
                        // Track this field
                        formFields.push({
                            path: `${currentPath}[${index}]`,
                            type: property.items.type,
                            element: itemField.querySelector('input, select, textarea').id
                        });
                    }
                    
                    // Add remove button
                    const removeButton = document.createElement('button');
                    removeButton.type = 'button';
                    removeButton.className = 'remove-item-btn';
                    removeButton.textContent = 'Remove';
                    removeButton.onclick = function() {
                        itemContainer.remove();
                    };
                    itemContainer.appendChild(removeButton);
                    
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
                const itemContainer = document.createElement('div');
                itemContainer.className = 'array-item';
                
                if (property.items.type === 'object') {
                    // Object array item
                    const itemPath = `${currentPath}[${itemCount}]`;
                    Object.keys(property.items.properties).forEach(propKey => {
                        const itemField = createFieldForProperty(
                            propKey, 
                            property.items.properties[propKey], 
                            null, 
                            itemPath,
                            formFields
                        );
                        itemContainer.appendChild(itemField);
                    });
                } else {
                    // Simple array item
                    const itemField = createSimpleArrayItem(key, property.items, '', itemCount);
                    itemContainer.appendChild(itemField);
                    
                    // Track this field
                    formFields.push({
                        path: `${currentPath}[${itemCount}]`,
                        type: property.items.type,
                        element: itemField.querySelector('input, select, textarea').id
                    });
                }
                
                // Add remove button
                const removeButton = document.createElement('button');
                removeButton.type = 'button';
                removeButton.className = 'remove-item-btn';
                removeButton.textContent = 'Remove';
                removeButton.onclick = function() {
                    itemContainer.remove();
                };
                itemContainer.appendChild(removeButton);
                
                itemsContainer.appendChild(itemContainer);
            };
            input.appendChild(addButton);
            break;
            
        case 'object':
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
                Object.keys(property.properties).forEach(propKey => {
                    const propField = createFieldForProperty(
                        propKey, 
                        property.properties[propKey], 
                        objValue[propKey], 
                        currentPath,
                        formFields
                    );
                    input.appendChild(propField);
                });
            }
            break;
            
        default:
            // Fallback to text input for unknown types
            input = document.createElement('input');
            input.type = 'text';
            input.id = key;
            input.name = key;
            input.value = value || '';
    }
    
    // Add input to fieldset
    if (property.type !== 'array' && property.type !== 'object') {
        fieldset.appendChild(input);
        
        // Track this field for later data extraction
        formFields.push({
            path: currentPath,
            type: property.type,
            element: input.id
        });
    } else {
        fieldset.appendChild(input);
    }
    
    return fieldset;
}

// Helper function to create a simple array item
function createSimpleArrayItem(key, itemSchema, value, index) {
    const container = document.createElement('div');
    container.className = 'simple-array-item';
    
    let input;
    
    // Create input based on item type
    switch (itemSchema.type) {
        case 'string':
            if (itemSchema.enum) {
                // Create a select dropdown for enum values
                input = document.createElement('select');
                input.id = `${key}-${index}`;
                input.name = `${key}-${index}`;
                
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
                input.id = `${key}-${index}`;
                input.name = `${key}-${index}`;
                input.value = value || '';
            }
            break;
            
        case 'number':
        case 'integer':
            input = document.createElement('input');
            input.type = 'number';
            input.id = `${key}-${index}`;
            input.name = `${key}-${index}`;
            input.value = value !== undefined && value !== null ? value : '';
            break;
            
        case 'boolean':
            input = document.createElement('input');
            input.type = 'checkbox';
            input.id = `${key}-${index}`;
            input.name = `${key}-${index}`;
            input.checked = value === true;
            break;
            
        default:
            // Fallback to text input
            input = document.createElement('input');
            input.type = 'text';
            input.id = `${key}-${index}`;
            input.name = `${key}-${index}`;
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
        
        formFields.forEach(field => {
            const element = document.getElementById(field.element);
            if (!element) {
                console.warn(`Element not found: ${field.element}`);
                return;
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
            
            // Set the value in the data object at the correct path
            setValueAtPath(data, field.path, value);
        });
        
        return data;
    } catch (error) {
        console.error('Error extracting form data:', error);
        return null;
    }
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