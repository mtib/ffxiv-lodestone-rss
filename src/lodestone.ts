import axios from 'axios';
import { parse } from 'node-html-parser';
import RSS from 'rss';
import fs from 'fs/promises';

const PREFIX = 'https://mtib.dev/';
const lodestoneURLs = [
    new URL('https://na.finalfantasyxiv.com/lodestone/news/'),
    new URL('https://eu.finalfantasyxiv.com/lodestone/news/'),
];

const parseNewsItem = (node: ReturnType<typeof parse>, lodestoneURL: URL) => {

    const href = node.querySelector('.news__list--title')?.querySelector('a')?.attributes['href'];
    const url = href !== undefined ? new URL(href, lodestoneURL) : undefined;
    const datestring = node.toString().match(/ldst_strftime\((\d+),.*\)/)?.at(1);
    const time = datestring !== undefined ? new Date(Number.parseInt(datestring, 10) * 1000) : undefined;

    return {
        title: node.querySelector('.news__list--title')?.textContent.trim(),
        link: url,
        time,
        content: node.querySelector('div')?.toString(),
    }
}

const feedFilename = (url: URL) => `${url.hostname}.rss`;

const generateRSS = async (lodestoneURL: URL) => {
    const { data: lodestoneHtml } = await axios.get<string>(lodestoneURL.href)

    const page = parse(lodestoneHtml);
    const newsList = page.querySelectorAll('li.news__list--topics.ic__topics--list');
    if (newsList === null) {
        console.log('news not found');
        process.exit(1);
    }
    const parsedNews = newsList.map(news => parseNewsItem(news, lodestoneURL));

    const feed = new RSS({
        title: lodestoneURL.hostname,
        feed_url: `${PREFIX}${feedFilename(lodestoneURL)}`,
        site_url: lodestoneURL.href,
    });

    parsedNews.forEach(({ title, link, time, content }) => {
        if (link === undefined) {
            return;
        }
        feed.item({
            date: time || new Date(0),
            title: title || 'Untitled news',
            url: link.href,
            description: content || 'No content',
            guid: link.href,
        })
    })

    return feed;
}

Promise.all(lodestoneURLs.map(async (url) => {
    const feed = await generateRSS(url);
    const filename = feedFilename(url);
    await fs.writeFile(filename, feed.xml());
    console.log(`writing ${filename}`);
})).then(() => {
    console.log('done');
})

