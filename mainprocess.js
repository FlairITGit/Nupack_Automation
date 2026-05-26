const db = require('./database');
const fs = require('fs');
const axios = require('axios');
const util = require('util');
const { get } = require('http');
const { resolve } = require('path');

// initial values
const filename = 'salesordernumber.json';
const defaultdata = {
    id100 : 38967,
    id200 : 65978,
    id400 : 54392,
    id600 : 4367,
    id100_before : 38967,
    id200_before : 65978,
    id400_before : 54392,
    id600_before : 4367,
};
var _header = {
    'TargetURL': 'http://flcasglobe01.flair.local:8020/services/Exact.Entity.REST.EG',
    //'TargetURL': 'http://flcatsglobe03.flair.local:8020/services/Exact.Entity.REST.EG',
    'Content-Type': 'application/json',
    'Username' : 'service.exact',
    'Password' : 'Fl@ir2012',
    //'Username' : 'service.tools',
    //'Password' : 'Fladb2012',
    'ServerName' : 'flcatssql02.flair.local',
    'DatabaseName' : '100',
    'Accept': 'application/json,text/javascript; charset=utf-8'
};
const _proxy_url = 'http://172.16.11.91:3000';

// AXIOS GET
const axios_get = axios.create({
    method : 'get',
    headers : _header,
});

// AXIOS POST
//_header.TargetURL = 'http://flcatsglobe02.flair.local:8020/services/Exact.Entity.REST.EG'
_header.ServerName = 'flcassqlnp01.flair.local';
_header.DatabaseName = '500';
const axios_post = axios.create({
    method : 'post',
    headers : _header,
});

// Check last Sales Order 
async function checklastsalesorderid(division){
    const select = 'TOP 1 ID';
    const table = `[${division}].dbo.orkrg with(NOLOCK)`;
    const where = `1 =1 order by id desc`;
    const result = await db.select('ca',select,table,where,false);
    //console.log(result.recordset);
    return result;
}

// Check Sales Order 
async function checksaleorder(id,division){
    const select = 'ordernr';
    const table = `[${division}].dbo.orkrg with(NOLOCK)`;
    const where = `ID = ${id}`;
    const result = await db.select('ca',select,table,where);
    //console.log(result.recordset);
    return result;
}
// Get real sales order
async function getsaleorder(id,division){
    const select = 'ordernr';
    const table = `[${division}].dbo.orkrg with(NOLOCK)`;
    const where = `ID = ${id} and ord_soort = 'B' and crdnr = '103700' and afgehandld = '0'`;
    const result = await db.select('ca',select,table,where,false);
    console.log(result.recordset);
    return result;
}

// Get Item
async function getitem(itemcode,division,select_ = '',table_ = '',where_ = ''){
    const select = select_ ? select_ : 'itemcode,description';
    const table = table_ ? table_ : `[${division}].dbo.items with(NOLOCK)`;
    const where = where_ ? where_ : `ItemCode = '${itemcode}'`;

    var result;
    if ( division == '500'){
        result = await db.select('nu',select,table,where,false);
    }else{
        result = await db.select('ca',select,table,where);
    }
    //console.log(result.recordset);
    return result;
}

// Get Items from sales order
async function getitemfromSO(ordernum,division){
    const select = 'artcode, division';
    const table = `[${division}].dbo.orsrg with(NOLOCK)`;
    const where = `ordernr = ${ordernum} and ar_soort != 'P' and artcode is not null `;
    const result = await db.select('ca',select,table,where,false);
    //console.log(result.recordset);
    return result;
}

// Get Items from sales order
async function mergewarehousedefault(itemcode){
    const table = `[500].dbo.voorrd`;
    const setitems = `maglok = 'Default'`;
    const where = `artcode = '${itemcode}' and magcode = '500'`;
    const result = await db.update('nu',table,setitems,where,false);
    //console.log(result.recordset);
    return result;
}

// Get from file
function getsalesordernumber(){
    var res,jsondata;

    try {
        res = fs.readFileSync(filename);
        jsondata = JSON.parse(res);

    }catch(err) {
        if ( err.code == 'ENOENT'){
            res = fs.writeFileSync(filename,JSON.stringify(defaultdata));
            jsondata = defaultdata;
        }else{
            console.log("Unknown Error. Please check.")
        }
    }

    // We have before field, because we have some problem
    // There is some timing issue between getting SO data and entering SO data
    // If those are happened at the same time, we can not read SO data.
    // That means we lost data.
    // So, we added before field. We re-read SO data which already read at 10 minutes ago one more time.
    // This is for above reason.
    var tmpid100 = jsondata.id100_before;
    var tmpid200 = jsondata.id200_before;
    var tmpid400 = jsondata.id400_before;
    var tmpid600 = jsondata.id600_before;
    jsondata.id100_before = jsondata.id100;
    jsondata.id200_before = jsondata.id200;
    jsondata.id400_before = jsondata.id400;
    jsondata.id600_before = jsondata.id600;
    jsondata.id100 = tmpid100;
    jsondata.id200 = tmpid200;
    jsondata.id400 = tmpid400;
    jsondata.id600 = tmpid600;

    return jsondata;
}

async function getSOfromeachdivision(filedata){
    var soarray = [],itemexistance = false;

    const iteration = [
        {idnum : filedata.id100, div : '100'},
        {idnum : filedata.id200, div : '200'},
        {idnum : filedata.id400, div : '400'},
        {idnum : filedata.id600, div : '600'}
    ]

    for ( let item in iteration ) {
        var result = await checksaleorder(iteration[item].idnum,iteration[item].div);

        // check this ID is latest ID.
        if ( result.rowsAffected != undefined && result.rowsAffected[0] == 0){
            var lastid = await checklastsalesorderid(iteration[item].div);
            //console.log(lastid.recordset[0].ID +"   " , iteration[item].idnum);
            if ( (lastid.recordset[0].ID + 1) != iteration[item].idnum){
                do{
                    iteration[item].idnum += 1;
                    result = await checksaleorder(iteration[item].idnum,iteration[item].div);
                }while(result.rowsAffected[0] == 0 && lastid.recordset[0].ID > iteration[item].idnum) 
            }
        }
        if (result.rowsAffected != undefined && result.rowsAffected[0] == 1){
            itemexistance = true;
            result = await getsaleorder(iteration[item].idnum,iteration[item].div);
            if (result.rowsAffected[0] == 1){
                var result_json = {};
                result_json.so_number = result.recordset[0].ordernr;
                result_json.division = iteration[item].div;
    
                soarray.push(result_json);
            }else {
                console.log("Item exist, but No nupack item")
            }

            // increase & save
            item == 0 ? filedata.id100 += 1 : 
                item ==1 ? filedata.id200 += 1 : 
                item ==2 ? filedata.id400 += 1 :
                item ==3 ? filedata.id600 += 1 : 0;
        }
    }
    // save current so number
    fs.writeFileSync(filename,JSON.stringify(filedata));

    var output = {
        itemexist : itemexistance,
        soarray : soarray,
    }
    return output;
}

// Get itemcode according to SO
async function getitemcodefromso(soresult){
    var itemarray = [];

    for ( let item in soresult ) {
        var result = await getitemfromSO(soresult[item].so_number,soresult[item].division);
        if ( result.rowsAffected[0] != 0){
            for ( let code in result.recordset){
                //console.log(result.recordset[code]);
                itemarray.push(result.recordset[code]);
            }
        }
    }
    return itemarray;
}

// Check Division 500 items
async function checkdivision500(artcode){
    var itemarray = [];

    for ( let item in artcode ) {
        var result = await getitem(artcode[item].artcode,'500');
        if ( result.rowsAffected[0] != 0){
            //console.log(result.recordset);
        }else{
            itemarray.push(artcode[item]);
        }
    }
    return itemarray;
}

// Retrieve Items
async function retrieveitems(artcode,callback){
    var itemarray = [];
    for ( let item in artcode ) {
        // var result = await getitem(artcode[item].artcode,artcode[item].division,'*');
        // if (result.rowsAffected[0] != 0){
        //     itemarray.push(result.recordset);
        // }
    console.log(artcode[item])

        var _url = _proxy_url + "/Item('" + artcode[item].artcode + "')";
        axios_get.defaults.headers['DatabaseName'] = artcode[item].division;
        var response = await axios_get(_url);

        // retrieve ITEM result data from server
        if (response.status != 200 ){
            console.log(">>>>>>  Item retrieve Error.")
            return;
        }
  
        console.log(`>> Retrieved ItemCode : ${response.data.d.ItemCode}`);
        itemarray.push(response.data.d);

        // callback function execute
        //if (callback != undefined){
        callback? callback(response.data.d):true;
        //}
    }

    return itemarray;
}

// Retrieve Cylinder
async function retrievecylinders(artcode,callback){
    var itemarray = [];

    for ( let item in artcode ) {
        var _url = _proxy_url + `/ItemRelation/?$filter=ItemCode eq '${artcode[item].artcode}'`;
        axios_get.defaults.headers['DatabaseName'] = artcode[item].division;

        var response = await axios_get(_url);

        // retrieve ITEM result data from server
        if (response.status != 200 ){
            console.log(">>>>>>  Item retrieve Error.")
            return;
        }
  
        if (response.data.d.results.length != 0){
            for ( let result of response.data.d.results){
                console.log(`itemcode : ${result.ItemCode}  --> Cylinder : ${result.ItemCodeRelated}`);
                delete result.__metadata;
                var cylinder_item = {
                    artcode : result.ItemCodeRelated,
                    division : artcode[item].division,
                    data : result
                }
                itemarray.push(cylinder_item);
    
                callback? callback(cylinder_item) : true;
            }
        }else{
            console.log("No Cylinder.");
        }
    }
    return itemarray;
}

// convert Item data for posting to DIV.500
function converitemdata(item){

    // Date Data
    delete item.__metadata;
    delete item.CountrySpecificAvailableFrom;
    delete item.CountrySpecificAvailableUntil;
    delete item.CreatedDate;
    delete item.ModifiedDate;
    delete item.SalesValidFrom;
    delete item.DateFreeField1;
    delete item.SalesID;
    
    item.Modifier = 1; 
    item.Creator = 1;

    // description length check routine.
    let buf = Buffer.from(item.Description0);
    if ( buf.length > 60){
        item.Description0 = buf.toString('utf8',0,60);
        item.CountrySpecificDescription = item.Description0;
        console.log('Description length is over 60byte. Automatically changed from')
        console.log(`'${buf.toString('utf8')}' to '${buf.toString('utf8',0,60)}'`);
    }
    
    // Main Conversion
    item.Warehouse = '500';
    item.CompanyCode = "500";
    item.CountrySpecificOwnerPerson = 1;
    item.CostPriceCurrency = "KRW";
    item.CostPriceStandard = 0.0;
    item.SalesCurrency = "KRW";
    item.SalesPrice = 0.0;
    item.SalesVATCode = "0";
    if ( item.Assourtment != 1070 ){
        item.Assortment = 1300;
        item.AssortmentCode = "1300";
        item.GLAccountRevenue = "41016020";
        item.GLAccountCost = "51016020";
        item.GLAccountDistribution = "11016020";
        item.IsAssembled = true;
        item.IsPurchaseItem = false;
    }else {
        item.Assortment = 1400;
        item.AssortmentCode = "1400";
        item.GLAccountRevenue = "41015030";
        item.GLAccountCost = "51015030";
        item.GLAccountDistribution = "11030070";
        item.IsAssembled = false;
        item.IsPurchaseItem = true;
    }
}

// POST ITEM
async function postitemdata(items,callback){
    // POST
    for ( let item in items ) {
        // Data modification
        converitemdata(items[item]);
        //console.log(util.inspect(JSON.stringify(items[item])))

        var _url = _proxy_url + '/Item';
        //axios_post.defaults.headers['DatabaseName'] = item.CompanyCode;
        var response = await axios_post({
            url : _url, 
            data : JSON.stringify(items[item])
        }).catch((resp)=>{
            console.log(util.inspect(resp.response.data,false,null,true));
            return {};
        });

        // retrieve ITEM result data from server
        if (response.status != 201 ){
            console.log(`>>>>>  Item POST Error : ITEMCODE : ${items[item].ItemCode}`)
            return response;
        }
  
        callback? callback(response) : true;

        console.log(`ITEM CODE : ${items[item].ItemCode} --> Success : ${response.status}`);
    }
    return response;
}

// POST WAREHOUSE
async function postwarehousedata(items,callback){
    // Warehouse Json data
    var warehousedata = {
        "CountingCycle": 0,
        "Creator": 1,
        "DeliveryTime": 0,
        "ItemCode": "",
        "Modifier": 1,
        "OrderPolicyCode": null,
        "PurchaseOrderLevel": 0,
        "Resource": 0,
        "MaximumStock": 0,
        "MinimumStock": 0,
        "WarehouseCode": "",
        "WarehouseLocation": 'default'
    }

    // POST
    for ( let item in items ) {
        // Merge 500 -->default
        var mergedefault = mergewarehousedefault(items[item].ItemCode);
        // if (mergedefault.rowsAffected[0] != 0){
        console.log(`--> merge result : 204 ( SUCCESS )`);
        // }else{
        //     console.log(`--> merge result : 400 ( FAIL )`);
        // }

        // INSERT REST API 598,599
        var _url = _proxy_url + '/WarehouseStock';

        warehousedata.ItemCode = items[item].ItemCode;

        const warehousecode = ['599','598'];
        for ( let warecode of warehousecode){
            warehousedata.WarehouseCode = warecode;
            var response = await axios_post({
                url : _url, 
                data : JSON.stringify(warehousedata)
            }).catch((resp)=>{
                console.log(util.inspect(resp.response.data,false,null,true));
                return {};
            });

            // retrieve ITEM result data from server
            if (response.status != 201 ){
                console.log(`>>>>>  Warehouse POST Error : ITEMCODE : ${items[item].ItemCode}`)
                return;
            }
            console.log(`WAREHOUSE CODE : ${items[item].ItemCode} / ${warecode} --> Success : ${response.status}`);

            callback ? callback(response) : true;
        }
    }
    return;
}

// POST Related
async function postrelateddata(items,callback){
    // POST
    for ( let item in items ) {
        var _url = _proxy_url + '/ItemRelation';

        // Warehouse Json data
        var relateddata = items[item].data;
        delete relateddata.__metadata;
        delete relateddata.ID;

        var response = await axios_post({
            url : _url, 
            data : JSON.stringify(relateddata)
        }).catch((resp)=>{
            console.log(resp.data);
            return {};
        });

        // retrieve ITEM result data from server
        if (response.status != 201 ){
            console.log(`>>>>>  relateddata POST ERROR : ITEMCODE : ${relateddata.ItemCode} / Cylinder : ${relateddata.ItemCodeRelated}`)
            return;
        }
        console.log(`Relateddata: ITEMCODE : ${relateddata.ItemCode} / CYLINDER : ${relateddata.ItemCodeRelated} --> Success : ${response.status}`);

        callback ? callback(response) : true;
    }
    return;
}

async function mainprocess(){
    var result = true;
    let t = new Date();
    console.log("\r\n\r\n--------------------------------------------------------------------------------")
    console.log(`Time : ${t.getFullYear()}/${t.getMonth() + 1}/${t.getDate()} ${t.getHours()+1}:${t.getMinutes()}:${t.getSeconds()}`);

    // 1. Read file to get ID or SO number
    const filedata = getsalesordernumber();

    while (result) {
        // 2, Get SO from each division
        console.log("\r\n[#### 1 ####] Start getting SO number")
        var soresult = await getSOfromeachdivision(filedata);
        if ( soresult.itemexist == false ){
            console.log("[No Sales Order]");
            return;
        }
        console.log(soresult);

        // 3. Get ItemCode according to SO from each division
        console.log("\r\n[#### 2 ####] Start getting ITEMCODE from Sales Order")
        var orsrg_result = await getitemcodefromso(soresult.soarray);
        if (orsrg_result.length == 0){
            console.log("[No Items]");
            continue;
        }
        console.log(orsrg_result);
        
        // 4. Check If this item is in the 500 division.
        console.log("\r\n[#### 3 ####] Start checking Itemcode from division 500")
        var div500_result = await checkdivision500(orsrg_result);
        if ( div500_result.length == 0){
            console.log("Already Div.500 have items.")
            continue;
        }
        console.log(div500_result);
            
        // 5. Get Items from each division
        console.log("\r\n[#### 4 ####] Retrieve Items from each division");
        var retrieve_items = await retrieveitems(div500_result);

        // 6. POST Items to division 500
        // 6.1 POST ITEMS
        console.log("\r\n[#### 5 ####] POST ITEM / WAREHOUSE to Div.500");
        var post_item = await postitemdata(retrieve_items);

        // 6.2 POST Warehouse
        var post_warehouse = await postwarehousedata(retrieve_items);

        // 7. Get Cyliner
        console.log("\r\n[#### 6 ####] Retrieve Cylinder if exist");
        var retrieve_related = await retrievecylinders(div500_result);
        //console.log(retrieve_related);
        if ( retrieve_related.length == 0){
            continue;
        }

        // 8. POST Cylinder
        // 8.1 Retrieve Cylinder item
        console.log("\r\n[#### 7 ####] GET CYLINDER ITEM from division");
        var retrieve_cylinders = await retrieveitems(retrieve_related);

        // 9. post cylinder
        console.log("\r\n[#### 8 ####] POST CYLINDER / WAREHOUSE to Div.500");
        var post_cylinder = await postitemdata(retrieve_cylinders);
        // 9.1 POST warehouse
        var post_cylinderwarehouse = await postwarehousedata(retrieve_cylinders);
        
        // 10. POST related
        console.log("\r\n[#### 9 ####] POST RELATED ITEM to Div.500");
        var post_relateddata = await postrelateddata(retrieve_related);

        console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
    }
}

module.exports = {
    mainprocess,
    retrieveitems,
    postitemdata,
    postwarehousedata,
    retrievecylinders,
    postrelateddata,
}