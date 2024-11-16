import axios from "axios";
import cheerio from "cheerio";
import https from "https";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import dotenv from "dotenv";
import _ from "lodash";

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
console.log("Firestore database initialized");

const visitedUrls = new Set();
const baseUrl = "https://www.flsenate.gov/Laws/Statutes";

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;
const REQUEST_TIMEOUT = 30000;
const RATE_LIMIT_DELAY = 2000;

// Create axios instance with custom configuration
const axiosInstance = axios.create({
  timeout: REQUEST_TIMEOUT,
  httpsAgent: new https.Agent({ 
    rejectUnauthorized: false,
    keepAlive: true,
    timeout: REQUEST_TIMEOUT
  }),
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  }
});

async function initializeState() {
  const stateRef = doc(db, "states", "florida");
  await setDoc(stateRef, {
    name: "Florida",
    abbreviation: "FL",
    lastUpdated: new Date().toISOString()
  }, { merge: true });
  console.log("Florida state document initialized");
}

function ensureAbsoluteUrl(href) {
  if (!href) return null;
  if (href.startsWith("//")) {
    return "https:" + href;
  } else if (href.startsWith("/")) {
    return "https://www.flsenate.gov" + href;
  } else if (href.startsWith("http")) {
    return href;
  } else {
    return null;
  }
}

function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\n\r\t]/g, ' ')
    .trim();
}

function extractLegislativeText($) {
  let text = '';
  try {
    const sectionTitle = $('span.CatchlineText').first().text().trim();
    if (sectionTitle) {
      text += `${sectionTitle}\n\n`;
    }

    const sectionBody = $('span.SectionBody').first();
    if (sectionBody.length) {
      const introText = sectionBody.find('span.Text.Intro.Justify').first().text().trim();
      if (introText) {
        text += `${introText}\n\n`;
      }

      sectionBody.find('div.Subsection').each((i, subsection) => {
        const number = $(subsection).find('span.Number').first().text().trim();
        const subsectionText = $(subsection).find('span.Text.Intro.Justify').first().text().trim();
        
        const paragraphs = [];
        $(subsection).find('div.Paragraph').each((j, paragraph) => {
          const paragraphNumber = $(paragraph).find('span.Number').first().text().trim();
          const paragraphText = $(paragraph).find('span.Text.Intro.Justify').first().text().trim();
          if (paragraphNumber && paragraphText) {
            paragraphs.push(`${paragraphNumber} ${paragraphText}`);
          }
        });

        if (number && subsectionText) {
          text += `${number} ${subsectionText}\n`;
          if (paragraphs.length > 0) {
            text += paragraphs.map(p => `    ${p}`).join('\n') + '\n';
          }
          text += '\n';
        }
      });
    }

    const history = $('div.History');
    if (history.length) {
      const historyText = history.find('span.HistoryText').text().trim();
      if (historyText) {
        text += `History.—${historyText}\n\n`;
      }
    }

    $('div.Note').each((i, note) => {
      const noteTitle = $(note).find('span.NoteTitle').text().trim();
      const noteText = $(note).find('span.Text.Intro.Justify').text().trim();
      if (noteTitle && noteText) {
        text += `${noteTitle}.—${noteText}\n`;
      }
    });

    return cleanText(text);
  } catch (error) {
    console.error('Error in extractLegislativeText:', error);
    return '';
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      await delay(RATE_LIMIT_DELAY); // Rate limiting
      const response = await axiosInstance.get(url);
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Retry ${i + 1}/${retries} for ${url}`);
      await delay(RETRY_DELAY * (i + 1)); // Exponential backoff
    }
  }
}

async function processLinks(links) {
  const batchSize = 2; // Reduced batch size
  const queue = Array.from(links);
  
  for (let i = 0; i < queue.length; i += batchSize) {
    const batch = queue.slice(i, i + batchSize);
    try {
      await Promise.all(batch.map(link => scrapeAndSave(link)));
      // Force garbage collection between batches
      if (global.gc) {
        global.gc();
      }
      await delay(RATE_LIMIT_DELAY);
    } catch (error) {
      console.error(`Error processing batch starting at index ${i}:`, error.message);
    }
  }
}

async function scrapeAndSave(url) {
  if (visitedUrls.has(url)) return;
  visitedUrls.add(url);
  console.log(`Scraping: ${url}`);

  try {
    const response = await fetchWithRetry(url);
    const html = response.data;
    let cheerioInstance = cheerio.load(html);

    const breadcrumbs = cheerioInstance("#breadcrumbs");
    const breadcrumbParts = breadcrumbs.text().trim().split(">");
    
    const titleLink = breadcrumbs.find('a').filter((i, el) => cheerioInstance(el).text().includes('Title'));
    const chapterLink = breadcrumbs.find('a').filter((i, el) => cheerioInstance(el).text().includes('Chapter'));
    
    const titleUrl = titleLink.length ? ensureAbsoluteUrl(titleLink.attr('href')) : null;
    const chapterUrl = chapterLink.length ? ensureAbsoluteUrl(chapterLink.attr('href')) : null;
    
    const titleBreadcrumb = breadcrumbParts.find((part) => part.includes("Title"));
    const chapterBreadcrumb = breadcrumbParts.find((part) => part.includes("Chapter"));
    const sectionBreadcrumb = breadcrumbParts.find((part) => part.includes("Section"));

    if (sectionBreadcrumb && titleBreadcrumb && chapterBreadcrumb) {
      const titleNumber = titleBreadcrumb.match(/Title (\w+)/)?.[1];
      const chapterNumber = chapterBreadcrumb.match(/Chapter (\d+)/)?.[1];
      const sectionNumber = sectionBreadcrumb.match(/Section (\d+)/)?.[1];

      if (!titleNumber || !chapterNumber || !sectionNumber) {
        console.log('Missing required numbers in breadcrumbs');
        return;
      }

      let titleDescription = '';
      const titleTOC = cheerioInstance('.miniStatuteTOC').first();
      if (titleTOC.length) {
        const descriptSpan = titleTOC.find('span.descript').first();
        if (descriptSpan.length) {
          titleDescription = descriptSpan.text().trim();
        }
      }

      const legislativeText = extractLegislativeText(cheerioInstance);
      
      if (legislativeText) {
        await saveSection(
          titleUrl || url, 
          chapterUrl || url, 
          url,
          legislativeText, 
          titleNumber, 
          chapterNumber, 
          sectionNumber, 
          titleDescription
        );
      }
    }

    // Process new links
    const newLinks = new Set();
    cheerioInstance("a[href]").each((i, link) => {
      const href = cheerioInstance(link).attr("href");
      const absoluteUrl = ensureAbsoluteUrl(href);
      if (absoluteUrl && absoluteUrl.startsWith(baseUrl) && !visitedUrls.has(absoluteUrl)) {
        newLinks.add(absoluteUrl);
      }
    });

    // Clear references to help with garbage collection
    cheerioInstance = null;

    if (newLinks.size > 0) {
      console.log(`Found ${newLinks.size} new links on ${url}`);
      await processLinks(newLinks);
    }
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
  }
}

async function saveSection(titleUrl, chapterUrl, sectionUrl, legislativeText, titleNumber, chapterNumber, sectionNumber, titleDescription) {
  const titleKey = _.snakeCase(`title_${titleNumber}`);
  const chapterKey = _.snakeCase(`chapter_${chapterNumber}`);
  const sectionKey = _.snakeCase(`section_${sectionNumber}`);

  const titleRef = doc(db, "states/florida/titles", titleKey);
  const chapterRef = doc(titleRef, "chapters", chapterKey);
  const sectionRef = doc(chapterRef, "sections", sectionKey);

  try {
    await setDoc(titleRef, {
      display_name: `Title ${titleNumber}`,
      title_number: titleNumber,
      description: titleDescription,
      url: titleUrl
    }, { merge: true });

    await setDoc(chapterRef, {
      display_name: `Chapter ${chapterNumber}`,
      chapter_number: chapterNumber,
      url: chapterUrl
    }, { merge: true });

    await setDoc(sectionRef, {
      display_name: `Section ${sectionNumber}`,
      content: legislativeText,
      sectionNumber: sectionNumber,
      lastUpdated: new Date().toISOString(),
      url: sectionUrl
    });

    console.log(`Successfully saved section: Title ${titleNumber}, Chapter ${chapterNumber}, Section ${sectionNumber}`);
  } catch (error) {
    console.error(`Error saving section ${titleNumber}/${chapterNumber}/${sectionNumber}:`, error.message);
  }
}

async function setup() {
  try {
    await initializeState();
    const startUrl = process.argv[2] || baseUrl;
    await scrapeAndSave(startUrl);
  } catch (error) {
    console.error("Unhandled error in main execution:", error);
  }
}

// Run with --expose-gc flag
setup();
