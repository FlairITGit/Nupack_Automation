var express = require('express'),
    bodyParser = require('body-parser'),
    app = express(),
    main = require('./mainprocess'),
    fs = require('fs');

var http = require('http').createServer(handler);
var io = require('socket.io')(http);
const PORT_No = 4000;

http.listen(PORT_No);
console.log("\r\n< Starting NUpack Automation Tool  > : Port : ",PORT_No);

//var myLimit = typeof(process.argv[2]) != 'undefined' ? process.argv[2] : '100kb';
//console.log('Using limit: ', myLimit);
//app.use(bodyParser.json({limit: myLimit}));

function handler(req,res){
    fs.readFile('nupackmain.html',function(err,data){
        if (err) {
            res.writeHead(404,{'Content-Type':'text/html'});
            return res.end("404 Not found");
        }
        res.writeHead(200,{'Content-Type':'text/html'});
        res.write(data);
        return res.end();
    });
}

io.on('connection',function(socket){
    console.log('Socket connected with Client!!')
    
    // Globe variables
    var retrieve_items=[],retrieve_related=[],retrieve_cylinders=[];

    // Retrieve items
    socket.on('itemcode',function(data){
        console.log("Manually retrieve Item")
        try{
            var jsondata = JSON.parse(data);
        }catch(err){
            console.log("wrong input");
            socket.emit('result',"Wrong data input!")
            return;
        }
        // delete all the buffer
        retrieve_items=[],retrieve_related=[],retrieve_cylinders=[];

        main.retrieveitems(jsondata,function(data){
            if (data.length != 0){
                socket.emit('result',`1.>> Retrieved ItemCode : ${data.ItemCode}`);
                retrieve_items.push(data);
            }
        });
    })
    // Post Items
    socket.on('postitem',function(data){
        console.log("Manually POST Item")
        main.postitemdata(retrieve_items,function(res){
            socket.emit('result',`2.>> POST ITEM response code : ${res.status}`);
        });
    })
    // Post warehouse
    socket.on('postitemwarehouse',function(data){
        console.log("Manually POST Warehouse")
        main.postwarehousedata(retrieve_items,function(res){
            socket.emit('result',`3.>> POST WAREHOUSE response code : ${res.status}`);
        });
    })
    // Retrieve Cylinder codes
    socket.on('getcylindercode',function(data){
        console.log("Manually check Cylinder Item")
        try{
            var jsondata = JSON.parse(data);
        }catch(err){
            console.log("wrong input");
            socket.emit('result',"Wrong data input!")
            return;
        }

        main.retrievecylinders(jsondata,function(data){
            socket.emit('result',`4.>> Cylinder Item : ${data.data.ItemCode} --> Cylinder : ${data.data.ItemCodeRelated}`);
            retrieve_related.push(data);
        });
    })
    // Retrieve Cylinder Items
    socket.on('getcylinderitem',function(data){
        console.log("Manually retrieve Cylinder Item");
        main.retrieveitems(retrieve_related,function(data){
            socket.emit('result',`5.>> Retrieved Cylinder Item : ${data.ItemCode}`);
            retrieve_cylinders.push(data);
        });
    })
    // POST Cylinder Items
    socket.on('postcylinderitem',function(data){
        console.log("Manually POST Cylinder Item");
        main.postitemdata(retrieve_cylinders,function(res){
            socket.emit('result',`6.>> POST ITEM response code : ${res.status}`);
        });
    })
    // Post warehouse
    socket.on('postcylinderwarehouse',function(data){
        console.log("Manually POST cylinder Warehouse")
        main.postwarehousedata(retrieve_cylinders,function(res){
            socket.emit('result',`7.>> POST WAREHOUSE response code : ${res.status}`);
        });
    })
    // Post related item
    socket.on('postrelateditem',function(data){
        console.log("Manually POST Related Item")
        main.postrelateddata(retrieve_related,function(res){
            socket.emit('result',`8.>> POST Related Item response code : ${res.status}`);
        });
    })
    // Post Delete item
    socket.on('postdeleteall',function(data){
        console.log("Delete all memory")
        retrieve_items=[],retrieve_related=[],retrieve_cylinders=[];
        socket.emit('result',`>>>>>  All data reset.`);
    })
    // Post related item
    socket.on('test',function(data){
        console.log("[test]")

        socket.emit('result',`>>>>>.`);
    })
})

process.on('SIGINT',function(){
    process.exit();
});

// app.all('*', function (req, res, next) {
//     console.log("get into - app.all")
//     fs.readFile('nupackmain.html',function(err,data){
//         res.writeHead(200,{'Content-Type':'text/html'});
//         res.write(data);
//         res.end();
//     });
// });

//app.set('port', process.env.PORT || 4000);
// app.listen(app.get('port'), function () {
//     console.log('Proxy server listening on port ' + app.get('port'));
// });

main.mainprocess();
const interobj = setInterval(main.mainprocess, 30*60*1000);
