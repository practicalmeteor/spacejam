var collectionNames = db.getCollectionNames();
for(var i = 0, len = collectionNames.length; i < len ; i++){
    var collectionName = collectionNames[i];
    if(collectionName != "system.users" && collectionName != "system.indexes" && db[collectionName]){
        db[collectionName].drop();
    }
}