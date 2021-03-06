const http   = require('http');
const kelp   = require('kelp');
const send   = require('kelp-send');
const body   = require('kelp-body');
const route  = require('kelp-route');
const cookie = require('kelp-cookie');
const KonKe  = require('..');

const konke = new KonKe({
  client_id    : '2d6M5lH0jBf72y6a',
  client_secret: 'c1895e1k3505701t'
});

const app = kelp();

app.use(send);
app.use(body);
app.use(cookie);

const url = 'http://konke.dev:3000';

app.use((req, res, next) => {
  const { code } = req.query;
  if(!code) return next();
  konke.accessToken(code, url).then(token => {
    res.cookie('access_token', token.access_token);
    res.redirect('/');
  }).catch(err => res.send(err));
});

app.use((req, res, next) => {
  const { access_token } = req.cookies;
  req.konke = new KonKe({ access_token });
  req.konke.checkAccessToken().then(next, e => res.redirect(konke.authorize(url)));
});

app.use((req, res, next) => {
  req.konke.user().then(user => {
    req.user = user;
    next();
  });
});

app.use((req, res, next) => {
  req
  .konke
  .getKList(req.user.userid)
  .then(devices => {
    req.devices = devices;
    next();
  });
});

app.use((req, res, next) => {
  const { user } = req;
  const stylesheet = `
  body{
    background: #bbb;
  }
  .container{
    width: 30%;
    margin: auto;
    padding: 50px;
    background: #fefefe;
    text-align: center;
  }
  .user{}
  .user img{
    width: 50px;
    height: 50px;
    border-radius: 100%;
  }
  .user span{
    color: #333;
    display: block;
  }
  .devices{
    padding: 0;
    min-height: 500px;
  }
  .devices li{
    list-style: none;
  }
  footer{
    text-align: center;
  }`;
  res.render = function(content){
    res.send(`
      <html>
        <head>
          <title>KonKe Example</title>
          <style>${stylesheet}</style>
        </head>
        <body>
          <div class="container" >
            <div class="user">
              <img src="" />
              <span>${user.username}</span>
              <a href="/logout">logout</a>
            </div>
            <div>${content}</div>
          </div>
          <footer>
            <a href="/">back home</a>
          </footer>
        </body>
      </html>
    `);
  };
  next();
});

app.use(route('get', '/', (req, res) => {
  const { devices } = req;
  res.render(`
    <ul class="devices" >
    ${devices.map(device => `
      <li>
        <a
          href="/${device.kid}" 
          mac="${device.device_mac}"
          type="${device.device_type}" >
          ${device.device_name}
        </a>
      </li>`
    ).join('')}
    </ul>`);
}));

app.use(route('get', '/logout', (req, res) => {
  res.cookie('access_token', 'xx', {
    expires: new Date
  });
  res.redirect('/');
}));

app.use(route('/:deviceId', (req, res, next) => {
  const { user, devices, params } = req;
  const kid = params.deviceId;
  req.device = devices.filter(k => k.kid === kid)[0];
  next();
}));

app.use(route('get', '/:deviceId', async (req, res, next) => {
  const { user, device, konke } = req;
  if(!device) return ;
  Object.assign(device, await konke.getKInfo(user.userid, device.kid));
  const state = await konke.getKState(user.userid, device.kid);
  const remote = await konke.getGeneralRemoteList(user.userid, device.kid);

  res.render(`
    <h2>${device.device_name}</h2>
    <p>${device.device_mac}</p>
    <p>${device.hardware}</p>
    <p>${device.software}</p>
    <p>state: ${state}</p>
    
    <form method="post" >
      <select name="command" >
        <option value="doSwitchK" >power</option>
        <option value="switchKLight" >led</option>
        <option value="sendGeneralRemoteOrder" >remote control</option>
      </select>
      <input name="params" />
      <button type="submit">execute</button>
    </form>`);
}));

app.use(route('post', '/:deviceId', async (req, res) => {
  const { user, device, konke, body } = req;
  let { command, params } = body;
  params = [ user.userid, device.kid ].concat(params.split(','));
  const result = await konke[ command ].apply(konke, params);
  res.render(`
    <p>${result.des}</p>
    <script>
      setTimeout(function(){
        window.location.href = window.location.href;
      }, 2000);
    </script>
  `);
}));

http.createServer(app).listen(3000);