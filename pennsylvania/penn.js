
/* 
Pennsylvania Web-Scraper
DataStorm - GMU (11-15-2024 to 11-17-2024)

Written by: Joanne Romo & Brenda Reyes 

*/

  /* ************************************************************* */

import axios from "axios";
import { load } from "cheerio";
import fs from "fs";

async function scrapeTable() {
  const url = "https://www.legis.state.pa.us/cfdocs/legis/LI/Public/cons_index.cfm"; 
  try {
    // const { data } = await axios.get(url);
    // const $ = cheerio.load(data);
    const { data: html } = await axios.get(url);
    const $ = load(html); 
    

    // Select the rows inside the table body
    const rows = $("table.DataTable tbody tr");

    // Extract and store data
    const titles = {};

    rows.each((index, row) => {
      const titleNum = $(row).find("td:nth-child(1)").text().trim(); // First column
      const titleName = $(row).find("td:nth-child(2)").text().trim(); // Second column

      // Extract URLs for HTML, PDF, and Word links
      const htmlLink = $(row).find("td:nth-child(4) a").attr("href");

      if (!titleNum || !titleName) return;
      
      // Ensure URLs are absolute
      const ensureAbsoluteUrl = (href) =>
        href && href.startsWith("http") ? href: `https://www.legis.state.pa.us ${href}`;

      titles[titleNum] = {
        display_name: "Title " + titleNum,
        title_number: titleNum,
        description: titleName, 
        url: htmlLink,
      };
    });

    // Write scraped titles to "titles.json"
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
}

scrapeTable();
