const sql = require('mssql');
let mssql = require('./mssql_pool_management.js');

const sqlConfig_ca = { 
  //server: 'flcatssql02.flair.local', 
  server: 'flcassql01.flair.local', 
  user: 'service.tools', 
  password: 'Fladb2012' ,
  connectionTimeout: 300000,
  requestTimeout: 300000,
  options: {
    encrypt: false, // for azure
    trustServerCertificate: false // change to true for local dev / self-signed certs
  }
};
const sqlConfig_nu = { 
  server: 'flcassqlnp01.flair.local', 
  user: 'service.tools', 
  password: 'Fladb2012' ,
  connectionTimeout: 300000,
  requestTimeout: 300000,
  options: {
    encrypt: false, // for azure
    trustServerCertificate: false // change to true for local dev / self-signed certs
  }
};

async function getsqlpool(server){
  let sqlpool, request;
  if ( server == 'ca'){
    sqlpool = await mssql.GetCreateIfNotExistPool(sqlConfig_ca);
    request = new sql.Request(sqlpool);
  }else if ( server == 'nu'){
    sqlpool = await mssql.GetCreateIfNotExistPool(sqlConfig_nu);
    request = new sql.Request(sqlpool);
  }else {
    console.log("Error : you must indicate server location");
  }
  return request;
}

async function select(server,select,table,where = '1=1',log=true){
  let result = await query( server,
    `SELECT ${select} FROM ${table} WHERE ${where}`,
    {},
    identity => identity , log
  );
  return result;
}

async function update(server,table,setitems,where = '1=1',log=true){
  let result = await query( server,
    `UPDATE ${table} SET ${setitems} WHERE ${where}`,
    {},
    identity => identity,log
  );
  return result;
}

// exports.insert = (table, item) =>
//   query(`INSERT INTO ${table} SET ?`, item, () => item)

// exports.update = (table, item) =>
//   query(
//     `UPDATE ${table} SET ? WHERE _id = ${connection.escape(item._id)}`,
//     item,
//     () => item
//   )

// exports.count = (table, clause) =>
//   query(
//     `SELECT COUNT(*) FROM ${table} ${clause}`,
//     {},
//     result => result[0]['COUNT(*)']
//   )

async function query(server, query, values, handler,log) {
  let request = await getsqlpool(server);

  return new Promise(function(resolve, reject){
    try{
      request.query(query,function(err,results){ 
        log ? console.log('--> query : ' + query) : true; 
        if (err) {
          console.log(err);
          //reject(err)
          resolve(handler({}));
        }
        //console.log(results);
        resolve(handler(results));
      });
    }catch{
      resolove(handler({}));
    }

  });
}

module.exports = {
  select,
  update
}