// const RSS_URL = "https://mdrss.tijlvdb.me/feed";
// const SCD_RSS_URL = "https://cors.iamneyk.workers.dev/?url=https://git.suicaodex.com/rss";
// import Parser from 'rss-parser';

// export async function fetchRssFeedByIds(ids:string[]) {
//     if (ids.length === 0) return null;

//     const params = ids.map(id => `q=manga:${id},tl:vi`).join("&");
//     const url = `${RSS_URL}?${params}`;
//     console.log("url", url);

//     const parser = new Parser();
//     const feed = await parser.parseURL(url);
//     // console.log("feed", feed.items);
    
//     return feed.items;
// }

// export async function fetchRssFeed(){
//     const parser = new Parser();
//     const feed = await parser.parseURL(SCD_RSS_URL);
//     // console.log("items", feed.items);
    
//     return feed.items;
// }