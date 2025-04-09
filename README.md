# DECK

## Overview
Comparison Deck is a flexible web-based evaluation tool designed to facilitate side-by-side comparison and assessment of content items. 
Originally developed for evaluating AI-generated content and dataset metadata curation, but this application can be adapted to compare any type of structured content where expert evaluation is needed.

## Purpose
This tool serves as a research instrument for:
- Comparing different representations or versions of structured content
- Standardizing descriptions across repositories
- Improving quality through expert review
- Streamlining curation workflows
- Supporting A/B/C testing for content design

## Key Features
- **Three-way Comparison**: View and compare three versions of content side-by-side
- **Scoring System**: Rate each version on a scale of 0-10
- **Content Editing**: Directly edit and improve items during the review process
- **API Integration**: Authenticate with API keys and update content automatically
- **Progress Tracking**: Save and resume evaluation sessions with local storage
- **Notes Field**: Add observations or justifications for scores during evaluation
- **JSON Schema Validation**: Ensure edited content conforms to established schemas

## Technical Components
- Pure JavaScript frontend with no framework dependencies
- Dynamic form generation based on JSON schema
- API integration for authentication and data updates
- Local storage for progress persistence
- Responsive design for various screen sizes

## Setup and Usage

### Prerequisites
- Access credentials for the content repository (currently Synapse)
- A URL to a properly formatted JSON containing the items to compare

### Configuration Options
The application can be configured through several parameters in `app.js`:
- `POST_ENDPOINT_URL`: Where evaluation results are submitted
- `SYNAPSE_USER_PROFILE_URL`: Authentication endpoint (can be modified for other APIs)
- `SCHEMA_URL`: Location of the JSON schema that defines the structure of editable content

### Basic Usage Flow
1. **Load Data**: 
   - Enter your API key
   - Provide a URL to the comparison JSON file
   - Click "Load Data & Schema"

2. **Comparison Process**:
   - Review the three content versions displayed side-by-side
   - Score each version (0-10)
   - Add optional notes about your evaluation
   - Click "Submit & Next" to proceed; scores will be sent and results will be applied

3. **Editing Content**:
   - Hover over any item card to reveal the "Edit" button
   - Make changes using the dynamically generated form
   - Save changes to improve the content

4. **Completion**:
   - After completing all comparisons, a summary screen will appear
   - Your progress is automatically saved in the browser

## Data Format
The application expects a JSON file with the following structure:
```json
{
  "cardsA": [/* Array of content objects */],
  "cardsB": [/* Array of content objects */],
  "cardsC": [/* Array of content objects */]
}
```

Each set should contain the same number of items, and each item should include at minimum an "id" field.

## Adaptation Guide
To adapt this tool for other content types:
1. Modify the configuration parameters in `app.js`
2. Update the JSON schema URL to point to your content structure definition
3. Adjust any display formatting in `renderCard()` function to suit your content type
4. Modify API endpoints and authentication as needed

## Development Notes
- The application uses a vanilla JavaScript form generator based on JSON schema
- The form validation ensures data integrity during editing
- Changes are tracked to provide an audit trail of modifications
- The application can be extended with custom rendering for different content types

## License
GNU General Public License v3 (GPL-3.0)
