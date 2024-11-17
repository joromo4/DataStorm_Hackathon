
/* 
Pennsylvania Web-Scraper
DataStorm Hackathon - GMU (11-15-2024 to 11-17-2024)

Written by: 
            Joanne Romo jromo4@gmu.edu
            Brenda Reyes breyes6@gmu.edu

*/

  /* ************************************************************* */

  import axios from "axios";
  import { load } from "cheerio";
  import fs from "fs";
  
  const ensureAbsoluteUrl = (href) =>
    href && href.startsWith("http") ? href : `https://www.legis.state.pa.us${href}`;
  
  // Scrape the titles from the table
  async function scrapeTable() {
    const url = "https://www.legis.state.pa.us/cfdocs/legis/LI/Public/cons_index.cfm"; 
    try {
  
      const { data: html } = await axios.get(url);
      const $ = load(html); 
      
      const rows = $("table.DataTable tbody tr");
      const titles = {};
  s
      rows.each((index, row) => {
        const titleNum = $(row).find("td:nth-child(1)").text().trim(); // First column
        const titleName = $(row).find("td:nth-child(2)").text().trim(); // Second column
        const htmlLink = $(row).find("td:nth-child(4) a").attr("href");
  
        if (!titleNum || !titleName) return;
        
        titles[titleNum] = {
          display_name: "Title " + titleNum,
          title_number: titleNum,
          description: titleName, 
          url: htmlLink, 
        };
      });
  
      // Write titles to "titles.json"
      fs.writeFile("titles.json", JSON.stringify({ titles: titles }, null, 2), (err) => {
          if (err) {
          console.error("Error writing to titles.json:", err);
          } else {
          console.log("Data written to titles.json successfully!");
          }
      });
    } catch (error) {
      console.error("Error scraping the table:", error.message);
    }
    //scrapeChapters();
  }
  
  
  
  /* Below is a (bad) attempt to get the chapters info within the titles
  *
  *  Quick points to be made:
  * 
  *  Chapters are not in a table like the titles! So we need to recognize the word "Chapter" within the text, 
  *  or grab the hyperlinks and assume BOLD in the html means Chapter, but non-bolded means sections.
  *  or some other way to identify the chapter number itself vs the sections since we can't take info from columns 
  *  like we did for scrapeTable().
  * 
  *  This currently does NOT write to the chapters.json file
  * 
  *  This was only pushed for the sake of progress, feel free to comment scrapeChapters() out
  *  to test scrapeTable() alone, OR even to start a new attempt for scrapeChapters. 
  *
  *   - Joanne Romo 11/17/2024
  */
  
  async function scrapeChapters() {
    const titlesJson = fs.readFileSync("titles.json", "utf8");
    const { titles } = JSON.parse(titlesJson);
  
    const chapterData = {};
  
  
    // Loop through each title
    for (const [titleNum, titleInfo] of Object.entries(titles)) {
      const { url } = titleInfo;
      if (!url) continue; // Skip if no URL is available
  
      console.log(`Fetching chapters for Title ${titleNum} from: ${url}`);
  
      try {
        // Fetch the HTML content of the chapter page
        const { data: chapterHtml } = await axios.get(url);
        const $ = load(chapterHtml);
  
        // Adjust the selectors based on the structure of the chapter pages
        const sections = $("div.chapter-section"); 
        // Example selector, adjust as needed
        const chapterSections = [];
  
        sections.each((index, section) => {
          const chapterNumber = $(section).find(".chapter-number").text().trim(); // Example selector
          const chapterTitle = $(section).find(".chapter-title").text().trim(); // Example selector
          const sectionUrl = $(section).find("a").attr("href"); // Adjust selector for links
          const absoluteSectionUrl = ensureAbsoluteUrl(sectionUrl);
  
          if (!chapterNumber && !chapterTitle) return;
            // Use chapter ID as the key in JSON
            chapters[chapterNumber] = {
              display_name: chapterTitle,
              chapter_number: chapterNumber,
              url: absoluteSectionUrl,
            };
          
        });
        
        // Write scraped chapters to "chapters.json"
        fs.writeFile("chapters.json", JSON.stringify({ chapters: chapterData }, null, 2), (err) => {
          if (err) {
            console.error("Error writing to chapters.json:", err);
          } else {
            console.log("Chapters written to chapters.json successfully!");
          }
        });
  
      } catch (error) {
        console.error(`Error fetching chapters for Title ${titleNum}:`, error.message);
      }
    }
  }
  
  
  /* 
  *  This is the main function to call scrapeTable, scrapeChapters, and scapeSections 
  *  in the future. Might need better implementation. 
  */
  async function main() {
    try {
  
      await scrapeTable();
  
      // Read the titles.json file to use for chapter scraping 
      const titlesJson = fs.readFileSync("titles.json", "utf8");
      const { titles } = JSON.parse(titlesJson);
  
      // Scrape chapters 
      await scrapeChapters();
    } catch (error) {
      console.error("Error during the scraping process:", error.message);
    }
  }
  
  main();