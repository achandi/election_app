//TODO: main features
  //use nested scraping (oneMemberinfo) for description info
  //export json files data to db
  //create front end 
  //set this up as a seperate scrape file, and once app complete set up cron jobs with chained scraping

//TODO: Refactoring
  // keep transitioning to async await (like your new openApi functions)
  //For Main(), refactor conservative, liberal and ndp with callObj and singleRequest() below, like green, peoples, and bloc set up later

const axios = require('axios');
const bloc = require('./input/blocqsite');
const _ = require('lodash');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const express = require('express');
const app = express();
const path = require('path');
const router = express.Router();

const qSel = (parent, child) => (Array.isArray(child) ? child.map(el => parent.querySelector(el) || '') : parent.querySelector(child) || ''); //querySelector
const getAttr = (el, attr) => el ? el[attr] || '' : '';  //for single element, get single attribute
const mapAttr = (arr, attr) => arr.map((el, i) => (el && (el[attr[i]] || el[attr]) ? el[attr[i]] || el[attr] : '')); //for multiple elements, get single attribute (supports array of attributes)

//For associted Main() functions, refactor conservative, liberal and ndp, using callObj and singleRequest() below, (like your newer green, peoples, and bloc functions)
const callObj = {
    // conservative: (data) => conservativeMain(data),
    // liberal: (data) => liberalMain(data),
    // ndp: (data) => ndpMain(data),
    green: data => greenMain(data),
    peoples: data => peoplesMain(data),
    bloc: data => blocMain(data)
  };
  
const singleRequest = (url, allSelector, party, filename, rawFile) => {
    url ? axios.get(url): Promise.resolve(rawFile)
        .then(rawRequest => {
        return Promise.resolve(rawRequest.data);
        })
        .then(rawHtmlReady => {
        const newParsedHtml = new JSDOM(rawHtmlReady);
        const memberList = Array.from(newParsedHtml.window.document.querySelectorAll(allSelector));
        return callObj[party](memberList);
        })
        .then(finalArr => {
        let finalArrJSON = JSON.stringify(finalArr, null, 2);
        fs.writeFileSync(filename, finalArrJSON);
        })
        .catch(err => {
        console.log(err);
        });
  };
  
  const getAllDistricts = () => {
    axios
      .get('https://www.elections.ca/Scripts/vis/SearchProvinces?L=e&PROV=CA&PROVID=99999&QID=-1&PAGEID=20')
      .then(rawRequest => {
        return Promise.resolve(rawRequest.data);
      })
      .then(rawHtmlReady => {
        const newParsedHtml = new JSDOM(rawHtmlReady);
        let districtList = Array.from(newParsedHtml.window.document.querySelector('tbody').querySelectorAll('tr'));
         districtList.shift();
        let arrayDistrict = [];
        districtList.forEach((districts, index) => {
          const district = districts.querySelectorAll('td');
          let riding = district[0].textContent.trim();
          riding = _.replace(riding, /\u2013|\u2014/g, '-');
          riding = _.replace(riding, /--/g, '-');
          const province = district[1].textContent.trim();
          arrayDistrict.push({ id: index, riding, province });
        });
        return Promise.resolve(arrayDistrict);
      })
      .then(finalArr => {
        const finalArrJSON = JSON.stringify(finalArr, null, 2);
        fs.writeFileSync('ridings-total.json', finalArrJSON);
      })
      .catch(err => {
        console.log(err);
      });
  };
  

const conservativeMain = () => {
  axios
    .get('https://www.conservative.ca/team/2019-candidates/')

    .then(rawRequest => {
      return Promise.resolve(rawRequest.data);
    })
    .then(rawHtmlReady => {
      const parsedHtml = new JSDOM(rawHtmlReady);
      let cabinetArray = [];
      let memberHrefArray = [];
      const members = parsedHtml.window.document.querySelectorAll('.cabinet-member');
      members.forEach(member => {
        let personalInfo = {};
        personalInfo.name = qSel(member,'h3').textContent;
        personalInfo.image = getAttr(qSel(member,'img'), ['src']);
        personalInfo.riding = _.replace(_.replace(qSel(member,'.riding-title').textContent, /\u2013|\u2014/g, '-'), / - /g, '-');
        // personalInfo.riding = _.replace(qSel(member,'.riding-title').textContent,/ — /g, '-')
        // let memberHref = qSel(member,'a') ? qSel(member,'a').href : '';
        personalInfo.website = memberHref;
        // if (memberHref) memberHrefArray.push(Promise.resolve(memberHref));
        // } else {
        //   memberHrefArray.push(Promise.resolve(0));
        // }
        cabinetArray.push(personalInfo);
      });
      return Promise.resolve(cabinetArray);
    })
    .then(finalArr => {
      let finalArrJSON = JSON.stringify(finalArr, null, 2);
      fs.writeFileSync('conservative-main.json', finalArrJSON);
    })
    .catch(err => {
      console.log(err);
    });
};

const liberalMain = () => {
  axios
    .get('https://www.liberal.ca/team-trudeau-2019-candidates/')
    .then(rawRequest => {
      return Promise.resolve(rawRequest.data);
    })
    .then(rawHtmlReady => {
      const parsedHtml = new JSDOM(rawHtmlReady);
      let cabinetArray = [];
      let memberHrefArray = [];
      const members = parsedHtml.window.document.querySelectorAll('.candidate-card');
      members.forEach(member => {
        let personalInfo = {};
        personalInfo.name = qSel(member,'.name').textContent;
        personalInfo.image = qSel(member,'.photo') ? qSel(member,'.photo').dataset.backgroundSrc : '';
        personalInfo.riding = _.replace(_.replace(qSel(member,'.riding').textContent, /\u2013|\u2014/g, '-'), / - /g, '-').trim();
        //    personalInfo.riding = _.replace(qSel(member,'.riding-title').textContent,/ — /g, '-')
        let social = ['facebook', 'twitter', 'instagram', 'website'].map((val) => `.candidate-social-link--${val}`);
        personalInfo.facebook = getAttr(qSel(member, social[0]), 'href');
        personalInfo.twitter = getAttr(qSel(member, social[1]), 'href');
        personalInfo.instagram = getAttr(qSel(member, social[2]), 'href');
        let memberHref = getAttr(qSel(member, social[3]), 'href');
        personalInfo.website = memberHref;
        let donationCheck = qSel(member,'.link-container-left').nextElementSibling;
        personalInfo.donate = donationCheck && donationCheck.textContent === 'Donate' && donationCheck.href ? donationCheck.href : '';
        cabinetArray.push(personalInfo);
      });
      return Promise.resolve(cabinetArray);
    })
    .then(finalArr => {
      let finalArrJSON = JSON.stringify(finalArr, null, 2);
      fs.writeFileSync('liberal-main.json', finalArrJSON);
    })
    .catch(err => {
      console.log(err);
    });
};

const ndpMain = (data) => {
  axios
    .get('https://www.ndp.ca/candidates')
    .then(rawRequest => {
      return Promise.resolve(rawRequest.data);
    })
    .then(rawHtmlReady => {
      const newParsedHtml = new JSDOM(rawHtmlReady);
      const memberList = Array.from(newParsedHtml.window.document.querySelectorAll('.campaign-civics-list-inner'));
      let membersArr = memberList.map(member => {
        let image = qSel(member,'.civic-image').dataset.imgSrc;
        let https = new RegExp('https');
        image = https.test(image) ? image : 'https://www.ndp.ca' + image;
        let civicData = qSel(member,'.civic-data').dataset;
        let { fullname, ridingName: riding, websiteLink: website, facebookLink: facebook, twitterLink: twitter, instagramLink: instagram, donateLink: donate } = civicData;
        riding = riding.replace('--', '-');
        donate = 'https://www.ndp.ca' + donate;
        fullname = fullname.replace(/  +/g, ' ');
        return { name: fullname, image, riding, twitter, instagram, facebook, website, donate };
      });
      return Promise.resolve(membersArr);
    })
    .then(finalArr => {
      let finalArrJSON = JSON.stringify(finalArr, null, 2);
      fs.writeFileSync('ndp-main.json', finalArrJSON);
    })
    .catch(err => {
      console.log(err);
    });
};

const greenMain = data => {
  return data.map(member => {
    let fullname = qSel(member, '.candidate-name').textContent;
    let image = qSel(member, '.candidate-image').dataset.src;
    image = image ? image.match(/ src='([^']*)'/)[1] || '' : '';
    let riding = _.replace(_.replace(qSel(member, '.riding-name').textContent, /\u2013|\u2014/g, '-'), / - /g, '-').trim();
    let website = qSel(member, '.modal-bio > a');
    website = website && website.href ? 'https://www.greenparty.ca' + website.href : '';
    let social = ['[title=Facebook]', '[title=Twitter]', '[title=Instagram]'];
    let [facebook, twitter, instagram] = mapAttr(qSel(member, social), 'href');
    let donate = qSel(member, '.btn-donate');
    donate = donate ? 'https://www.greenparty.ca' + donate : '';
    return { name: fullname, image, riding, twitter, instagram, facebook, website, donate };
  });
};

const peoplesMain = data => {
  return data.map(member => {
    if (!qSel(member,'strong')) {
      let memberInfo = Array.from(member.querySelectorAll('td'));
      let fullname = memberInfo[1].textContent;
      let image = qSel(memberInfo[2], 'a');
      image = image ? image.href || '' : '';
      twitter = image;
      image = image ? image + '/profile_image?size=original' : '';
      let riding = memberInfo[0].textContent;
      let facebook = getAttr(qSel(memberInfo[3], 'a'), 'href');
      let website =  getAttr(qSel(memberInfo[4], 'a'), 'href');
      return { name: fullname, image, riding, twitter, facebook, website };
    }
  });
};

const urlObj = bloc.blocQ.districts;
// arr.reduce((obj, item) => (obj[item.key] = item.value, obj) ,{});

const blocMain = data => {
  return data.map((member, ind) => {
    let memberInfo = qSel(member, '.image a') || qSel(member, '.infos h1 a');
    let [nameRiding, website, image] = mapAttr(
      Array(2)
        .fill(memberInfo)
        .concat([qSel(memberInfo, 'img')]),
      ['title', 'href', 'src']
    );
    image = 'https://www.blocquebecois.org' + image;
    let [riding, fullname] = nameRiding.split(':').map(item => item.trim());
    let website_id = urlObj[riding] || '';
    riding = _.replace(_.replace(riding, /\u2013|\u2014/g, '-'), / - /g, '-').trim();
    website = website_id ? 'https://www.blocquebecois.org/candidats/?district=' + website_id : website;
    let facebook = '',
      twitter = '',
      instagram = '';
    member.querySelectorAll('.fb').forEach(type => {
      facebook = /facebook/.test(type.href) ? type.href : facebook;
      twitter = /twitter/.test(type.href) ? type.href : twitter;
      instagram = /instagram/.test(type.href) ? type.href : instagram;
    });
    return { name: fullname, image, riding, facebook, twitter, instagram, website };
  });
};

// router.get('/', function)

const openUrl = 'https://represent.opennorth.ca/candidates/house-of-commons/?limit=1000';
const openUrl2 = openUrl + '&offset=1000';

const openApiCreate = async () => {
  try {
    const response = await Promise.all([axios.get(openUrl), axios.get(openUrl2)]);
    const openJson = response[0].data.objects.concat(response[1].data.objects);
    const finalArrJSON = JSON.stringify(openJson, null, 2);
   await fs.writeFile('./scraped_data/openapi.json', finalArrJSON);
  } catch (err) {
    console.log(err);
  }
};

const openApiRead = async () => {
  try {
    const toRead = await readFile('./scraped_data/openapi.json');
    const returnValue = JSON.parse(toRead);
    return returnValue;
  } catch (err) {
    console.log(err);
  }
};

const fixRiding = riding => _.replace(_.replace(riding, /\u2013|\u2014/g, '-'), / - /g, '-').trim();

const openApiUpdate = async () => {
  let ridingObj = {};
  const toUpdate = await openApiRead();
  const updates = toUpdate.map(member => {
    const riding = fixRiding(member.district_name);
    const name = member.name;
    const party = member.party_name;
    member.riding = riding;
    let ridingIdFind = member.related.boundary_url.split('/');
    const ridingId = ridingIdFind.slice('-2', '-1')[0];
    member.ridingId = ridingId;
    if (ridingObj[ridingId]) {
      ridingObj[ridingId].candidate[party] = name;
    } else {
      ridingObj[ridingId] = { riding: riding, 
                              candidate: { [party]: name } };
    }
    delete member.district_name;
    return member;
  });

  let finalArrJSON = JSON.stringify(updates, null, 2);
  let finalArrJSON2 = JSON.stringify(ridingObj, null, 2);

  return await Promise.all(writeFile('./scraped_data/openapi.json', finalArrJSON), writeFile('./scraped_data/riding-table.json', finalArrJSON2));

};
router.get('/', function(req, res) {
  //TODO set up cron job + chained scraping once app set up
  //openApiCreate().catch(err => console.log(err));
  openApiUpdate().catch(err => console.log(err));
  // singleRequest('https://www.greenparty.ca/en/candidates', '.candidate-card', 'green', './scraped_data/green-main.json');
  // singleRequest('https://www.peoplespartyofcanada.ca/our_candidates', '.candidatetable tr', 'peoples', './scraped_data/peoples-main.json');
  // singleRequest(false, 'article', 'bloc', './scraped_data/bloc-main.json', bloc.blocQ);
  // ndpMain()
  // conservativeMain()
  // getAllDistricts();
  // liberalMain()
});

app.use('/', router);
app.listen(process.env.port || 3500);

console.log('Running at Port 3500');

//for descriptions later
// const oneMemberInfo = memberArr => {
//   let descripArr = [];
//   return Promise.all(memberArr)
//     .then(pageArr => {
//       pageArr.forEach(page => {
//         let personalInfo = {};
//         if (page) {
//           memberPage = new JSDOM(page).window;
//           personalInfo.description = '';
//           memberPage.document
//             .querySelector('.team-bio-image')
//             .nextElementSibling.querySelectorAll('p')
//             .forEach(paragraph => {
//               personalInfo.description = personalInfo.description + (personalInfo.description.length ? ' +++ ' : '') + paragraph.textContent;
//             });
//           memberPage.document
//             .querySelector('.social-nav')
//             .querySelectorAll('a')
//             .forEach(social => {
//               personalInfo[social.dataset.type] = social.href;
//             });
//         } else {
//           personalInfo.description = '';
//         }
//         descripArr.push(personalInfo);
//         return descripArr;
//       });
//     })
//     .catch(err => {
//       console.log(err);
//     });
// };
