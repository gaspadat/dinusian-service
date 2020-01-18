const axios = require('axios');
const dinusweb = require('../services/dinusweb');
const Announcement = require('../models/announcement');
const chat = require('../chat');


// eslint-disable-next-line no-unused-vars
const getFortuneCookie = async () => {
  const response = await axios.get('http://fortunecookieapi.herokuapp.com/v1/cookie');
  const quote = response.data[0].fortune.message;
  return quote;
};


const startProcessDataAnnouncements = async () => {
  const announcements = await dinusweb.getAnnouncements();

  /* get the contents */
  const announcementUrls = announcements.map(i => i.rawUrl);
  const promisGetContents = announcementUrls.map(url => dinusweb.getContentAnnouncement(url));
  const contents = await Promise.all(promisGetContents);
  const completeAnnouncements = announcements.map((item, idx) => ({ ...item, content: contents[idx] }));

  /* populate db */
  const promiseUpdates = completeAnnouncements
    .map(item => Announcement.findOneAndUpdate({ rawId: item.rawId }, item, { upsert: true }));
  const results = await Promise.all(promiseUpdates);

  return results.map((r, idx) => r || announcements[idx]); // the new inserted  announcement result null
};


const defineJob = async (job, done) => {
  console.log('>> mulai scrapping data pengumuman...');
  try {
    const results = await startProcessDataAnnouncements();
    const newItems = results.filter(item => !item.id); // the new inserted doesn't have id
    if (newItems.length > 0) {
      newItems.forEach(item => {
        const message = `Pengumuman
                        *\n${item.title}* \n[Selengkapnya](${item.rawUrl})`;
        chat.broadcastChannel(message);
      });
    } else {
      const quote = await getFortuneCookie();
      chat.broadcastChannel(`"${quote}"`);
    }
    done();
  } catch (error) {
    console.error(error);
    done(error);
  }
};


module.exports = defineJob;