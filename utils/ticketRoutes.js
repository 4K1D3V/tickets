const router = require("express").Router();
const fs = require("fs");
const db = require("quick.db");
const yaml = require("js-yaml");
const config = yaml.load(fs.readFileSync('./configs/config.yml', 'utf8'));
const language = yaml.load(fs.readFileSync('./configs/language.yml', 'utf8'));

// Route for Ticket Transcript
router.get("/:id", async (req, res) => {
  let id = req.params.id;
  let accessCode = req.query.accessCode;
  let fileLoc = `./transcripts/ticket-${id}.html`;
  let fileExist = fs.existsSync(fileLoc);
  if (!fileExist) return res.send(`Ticket with ID ${id} doesn't exist.`);
  let fileToSend = fs.readFileSync(fileLoc, "utf8");
  
  if(config.server.selfhost.public_transcripts == false) {
    let transcriptCode = db.fetch(`transcript_${id}`) || "1230987abc";
    let promptTitle = language.ticket.transcript_prompt;
    
    if ((!accessCode || transcriptCode != accessCode) && accessCode != config.server.selfhost.admin_login && accessCode != "exit") return res.send(`
          <script>
            window.location.href = "/tickets/${id}?accessCode="+prompt("${promptTitle}");
          </script>
        `);
    
    if (accessCode == "exit")
      return res.send();
  }
  
  res.send(fileToSend);
});

// Route for Downloading Ticket Transcript
router.get("/:id/download", async (req, res) => {
  if (config.server.selfhost.download == false) return res.send("Transcript downloading is disabled.");

  let id = req.params.id;
  let accessCode = req.query.accessCode;
  let fileLoc = `./transcripts/ticket-${id}.html`;
  let fileExist = fs.existsSync(fileLoc);
  if (!fileExist) return res.send(`Ticket with ID ${id} doesn't exist.`);
  
  if(config.server.selfhost.public_transcripts == false) {
    let transcriptCode = db.fetch(`transcript_${id}`) || "1230987abc";
    let promptTitle = language.ticket.transcript_prompt;
    
    if ((!accessCode || transcriptCode != accessCode) && accessCode != config.server.selfhost.admin_login && accessCode != "exit") return res.send(`
          <script>
            window.location.href = "/tickets/${id}?accessCode="+prompt("${promptTitle}");
          </script>
        `);
    
    if (accessCode == "exit")
      return res.send();
  }

  res.download(fileLoc, `transcript-${id}.html`);
});

module.exports = router;
