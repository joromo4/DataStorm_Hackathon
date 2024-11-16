# Legislative Web Scraping Project

## Overview
This project aims to scrape and structure legislative data from various US states into a consistent JSON format. Each state has unique challenges and data structures that need to be handled appropriately.

## Getting Started
1. Install dependencies:
```bash
npm install axios cheerio dotenv lodash
```

2. Create output directories:
```bash
mkdir -p data/{titles,chapters,sections}
```

## State Sources
```
HAWAII
Main Source: https://www.capitol.hawaii.gov/docs/HRS.htm

MASSACHUSETTS
Main Source: https://malegislature.gov/Laws/GeneralLaws

OHIO
Main Source: https://codes.ohio.gov/ohio-revised-code

PENNSYLVANIA
Main Source: https://www.legis.state.pa.us/cfdocs/legis/LI/Public/

TEXAS
Main Source: https://statutes.capitol.texas.gov/
```

## Data Structure and Output Files

### titles.json
```json
{
    "titles": {
        "[title_id]": {
            "display_name": "Title X",
            "title_number": "X",
            "description": "Title Description",
            "url": "https://www........com"
        }
    }
}
```

### chapters.json
```json
{
    "chapters": {
        "[chapter_id]": {
            "display_name": "Chapter Y",
            "chapter_number": "Y",
            "url": "https://www........com"
        }
    }
}
```

### sections.json
```json
{
    "sections": {
        "[section_id]": {
            "display_name": "Section Z",
            "section_number": "Z",
            "content": "Full section text",
            "url": "Source URL",
            "last_updated": "ISO timestamp"
        }
    }
}
```

## Key Features
- Scrapes legislative data from state websites
- Outputs data in structured JSON files
- Handles rate limiting and retries
- Cleans and standardizes text content
- Maintains source URLs for reference

## Best Practices
1. Data Collection
   - Implement rate limiting (1 request per second recommended)
   - Handle errors gracefully with retries
   - Maintain session handling where required
   - Log all failed requests for later review

2. Data Processing
   - Clean and standardize text formatting
   - Remove unwanted HTML tags and entities
   - Normalize whitespace and special characters
   - Convert dates to ISO format

3. File Management
   - Create backup of existing files before updating
   - Implement atomic writes using temporary files
   - Validate JSON structure before saving
   - Use consistent file naming conventions

4. Error Handling
   - Log all errors with timestamps
   - Implement graceful degradation
   - Save partial progress on failure
   - Include error recovery procedures

## File Organization
```
project/
├── data/
│   ├── titles/
│   │   └── [state]_titles.json
│   ├── chapters/
│   │   └── [state]_chapters.json
│   └── sections/
│       └── [state]_sections.json
├── src/
│   ├── scrapers/
│   │   └── [state]_scraper.js
│   ├── utils/
│   │   ├── cleaners.js
│   │   └── validators.js
│   └── index.js
└── logs/
    └── error.log
```

## Example Usage
```javascript
const scraper = require('./src/scrapers/hawaii_scraper');

async function main() {
    try {
        await scraper.scrapeTitles();
        await scraper.scrapeChapters();
        await scraper.scrapeSections();
        console.log('Scraping completed successfully');
    } catch (error) {
        console.error('Scraping failed:', error);
    }
}

main();
```

## Reference Implementation
See examples for Florida, Idaho, and Virginia in the repository for implementation patterns.

## Data Validation
Before saving any JSON file, validate:
- Required fields are present
- Data types are correct
- URLs are valid
- IDs are unique
- Content is properly sanitized

## Error Recovery
1. If scraping fails:
   - Check error logs in `logs/error.log`
   - Resume from last successfully processed item
   - Use backup files if necessary
   - Verify output file integrity

2. Common issues and solutions:
   - Rate limiting: Adjust request delays
   - Network errors: Implement exponential backoff
   - Parse errors: Check for site structure changes
   - File system errors: Verify permissions and space
