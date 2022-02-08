const createOrUpdateObjInListById = (arr, obj) => {
  const index = arr.findIndex((arrItem) => arrItem.id === obj.id);
  if (index) {
    arr[index] = obj;
  } else {
    arr.push(obj);
  }

  return arr;
};
