// Redflow email relay for Google Apps Script.
// Deploy: script.google.com -> New project -> paste -> Deploy -> New deployment -> Web app,
// "Execute as: Me", "Who has access: Anyone". Copy the web app URL.
// Then in the module: set_email_provider("webhook", "<web app URL>", "", "<SHARED_TOKEN>")
// Emails are sent from the Google account that deployed the script. Free quota is about 100 a day.

var SHARED_TOKEN = 'change-me-to-a-long-random-string';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    if (!body.token || body.token !== SHARED_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'bad token' })).setMimeType(ContentService.MimeType.JSON);
    }
    if (!body.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to)) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'bad recipient' })).setMimeType(ContentService.MimeType.JSON);
    }
    MailApp.sendEmail({
      to: body.to,
      subject: String(body.subject || 'Redflow verdict').slice(0, 200),
      body: String(body.text || ''),
      htmlBody: String(body.html || ''),
      name: 'Redflow',
    });
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput('Redflow relay is up.');
}
