const uploadDir = "/upload";

function UploadFile(type: string, file: YaoFile, folder: string) {
  const filePath = saveFile(type, file, folder);
  return {
    value: `/api/v1/fs/${type}/file/download?name=${filePath}`,
  };
}

function getFolder(type: string) {
  let filePath = `${uploadDir}/public`;
  switch (type) {
    case "user":
      let user_id = Process("session.get", "user_id");
      if (!user_id) {
        user_id = "1";
      }
      filePath = `${uploadDir}/${user_id}`;
      break;
    case "public":
      filePath = `${uploadDir}/public`;
      break;
    default:
      throw new Exception(`File Type ${type} is not support`, 500);
    // break;
  }

  if (!Process("fs.system.Exists", filePath)) {
    Process("fs.system.Mkdir", filePath);
  }
  return filePath;
}
function deleteFile(name: string) {
  const fname = getUserFilePath(name);

  return Process("fs.system.Remove", fname);
}
function queryEscape(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
    return "%" + c.charCodeAt(0).toString(16);
  });
}
function getBasename(filename: string) {
  if (filename == null) {
    return "";
  }
  // Get the last index of the path separator '/'
  const lastIndex = filename.lastIndexOf("/");

  // If the separator is found, return the substring after it
  if (lastIndex !== -1) {
    filename = filename.substring(lastIndex + 1);
  }
  // If no separator found, return the filename as it is
  return queryEscape(filename);
}
// yao run scripts.fs.file.getFilePath
function getFilePath(type: string, name: string) {
  const filePath = `${getFolder(type)}/${name}`;
  return filePath;
}

function saveFile(type: string, file: YaoFile, folder: string) {
  if (folder == null || folder == "") {
    folder = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  } else {
    // folder = folder.replace(".", "/");
  }
  folder = normalizeFolder(folder);
  const uploadFolder = `${getFolder(type)}/${folder}`;
  const filePath = `/${uploadFolder}/${file.name}`;

  // 只返回用户的目录下的相对路径
  const filePath2 = `/${folder}/${file.name}`;

  let fs = new FS("system");
  if (!fs.Exists(uploadFolder)) {
    fs.MkdirAll(uploadFolder);
  }
  fs.Move(file.tempFile, `${filePath}`);

  return filePath2;
  // return fs.Abs(filePath2);
}

// yao run scripts.fs.file.getFolderList
function getFolderList(type: string, parent: string) {
  // parent = normalizeFolder(parent);

  // const parentDir = parent.replace(/\./g, "/");
  const parentDir = normalizeFolder(parent);

  const userDir = getFolder(type);

  const uploadFolder =
    parentDir != "" ? `${userDir}/${parentDir}/` : `${userDir}/`;

  if (!Process("fs.system.Exists", uploadFolder)) {
    return [];
  }
  let list = Process("fs.system.ReadDir", uploadFolder);
  list = list.map((l) => l.replace(/\\/g, "/"));
  let list2 = list.filter((dir: string) => Process("fs.system.isDir", dir));
  // console.log("list2:", list2);
  list2 = list2.map((dir: string) => {
    const d = dir.replace(uploadFolder, "");

    return {
      label: d,
      value: parent != "" ? parent + "/" + d : d,
      defer: true,
    };
  });

  return list2;
  // return convertToNestedArray(list2);
}
// yao run scripts.fs.file.getFileList '20231115'
function getFileList(type: string, folder: string) {
  if (folder == null || folder == "") {
    throw new Exception("目录不正确", 500);
    // folder = folder.replace(".", "/");
  }
  folder = normalizeFolder(folder);
  let userFolder = getFolder(type);
  const uploadFolder = `${userFolder}/${folder}/`;

  let list = Process("fs.system.ReadDir", uploadFolder);
  list = list.map((l) => l.replace(/\\/g, "/"));

  const list2 = [] as FileList[];
  list.forEach((f: string) => {
    const isFile = Process("fs.system.IsFile", f);
    if (isFile) {
      const fpath = f.replace(userFolder, "");

      const fname = f.replace(uploadFolder, "");
      const mimeType = Process("fs.system.MimeType", f);
      const bytes = Process("fs.system.Size", f);
      list2.push({
        size: convertFileSize(bytes),
        name: fname,
        path: fpath,
        url: `/api/v1/fs/${type}/file/download?name=${fpath}`,
        mime: mimeType,
        type: getFileTypeFromMimeType(mimeType),
      } as FileList);
    }
  });
  return list2;
}

function getFileTypeFromMimeType(mimeType) {
  // Remove any additional information after the main MIME type
  const mainType = mimeType.split(";")[0];

  // Map MIME types to human-readable file types
  const typeMap = {
    "application/pdf": "PDF Document",
    "image/jpeg": "JPEG Image",
    "image/png": "PNG Image",
    "image/gif": "GIF Image",
    "text/plain": "Text Document",
    "application/msword": "MS Word Document",
    "application/vnd.ms-excel": "MS Excel Spreadsheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "MS PPT",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "MS WORD",
    // Add more MIME types and their corresponding file types as needed
  };

  // Check if the MIME type exists in the typeMap
  if (typeMap.hasOwnProperty(mainType)) {
    return typeMap[mainType];
  } else {
    return mimeType;
  }
}
function convertFileSize(fileSizeInBytes: number) {
  const units = ["bytes", "KB", "MB", "GB"];
  let unitIndex = 0;
  let fileSize = fileSizeInBytes;

  while (fileSize >= 1024 && unitIndex < units.length - 1) {
    fileSize /= 1024;
    unitIndex++;
  }

  return `${fileSize.toFixed(2)} ${units[unitIndex]}`;
}
// yao run scripts.fs.file.normalizeFolder "../"
function normalizeFolder(folder: string) {
  if (folder == null) {
    return "";
  }
  if (typeof folder != "string" && typeof folder != "number") {
    return "";
  }
  // 安全问题，可以通过../访问非应用目录
  folder = folder.replace(/\.\./g, "");
  folder = folder.replace(/\/+/g, "/");
  folder = folder.replace(/\\+/g, "/");

  return folder;
}
function createFolder(type: string, parent: string, folder: string) {
  if (parent == null || typeof parent != "string") {
    parent = "";
  }
  // parent = parent.replace(/\./g, "/");

  parent = normalizeFolder(parent);
  folder = normalizeFolder(folder);

  if (folder == "") {
    throw new Exception("目录名不能为空", 500);
  }
  const uploadFolder = `${getFolder(type)}/${parent}/${folder}`;
  let fs = new FS("system");
  if (!fs.Exists(uploadFolder)) {
    fs.MkdirAll(uploadFolder);
  }
}
function deleteFolder(type: string, folder: string) {
  if (folder == null || folder == "") {
    throw new Exception("目录不正确", 500);
    // folder = folder.replace(/\./g, "/");
  }
  folder = normalizeFolder(folder);

  const uploadFolder = `${getFolder(type)}/${folder}`;
  let fs = new FS("system");
  if (fs.Exists(uploadFolder)) {
    fs.RemoveAll(uploadFolder);
  }
}
function moveFolder(type: string, source: string, target: string) {
  if (source == null || source == "") {
    throw new Exception("源目录不能为空");
  }
  if (target == null || target == "") {
    throw new Exception("目标目录不能为空");
  }

  source = normalizeFolder(source);
  target = normalizeFolder(target);

  // source = source.replace(".", "/");
  // target = target.replace(".", "/");

  const sourceFolder = `${getFolder(type)}/${source}`;
  const targetFolder = `${getFolder(type)}/${target}`;

  let fs = new FS("system");

  let targetParent = targetFolder.split("/").slice(0, -1).join("/");
  if (!fs.Exists(targetParent)) {
    fs.MkdirAll(targetParent);
  }
  if (fs.Exists(sourceFolder) && !fs.Exists(targetFolder)) {
    fs.Move(sourceFolder, targetFolder);
  }
}

function convertToNestedArray(folderList: string[]): object[] {
  // Initialize the root object
  const root = {
    label: "",
    value: "",
    defer: true,
    children: [],
  };

  // Iterate through each folder path
  for (const folderPath of folderList) {
    // Split the folder path into individual parts
    const parts = folderPath.split("/").filter((part) => part !== "");

    // Initialize the current node as the root
    let currentNode = root;

    // Iterate through each part of the folder path
    for (const part of parts) {
      // Check if the current part already exists as a child
      let foundNode = currentNode.children.find((node) => node.label === part);

      // If the node does not exist, create a new one
      if (!foundNode) {
        foundNode = {
          label: part,
          defer: true,
          value: currentNode.value ? `${currentNode.value}/${part}` : part,
          children: [],
        };
        currentNode.children.push(foundNode);
      }

      // Update the current node to the found node
      currentNode = foundNode;
    }
  }
  removeEmptyChildren(root);
  return root.children;
}

function removeEmptyChildren(node) {
  if (node.children.length === 0) {
    delete node.children;
  } else {
    for (const child of node.children) {
      removeEmptyChildren(child);
    }
  }
}

interface FileList {
  name: string;
  path: string;
  url: string;
  size: string;
  mime: string;
  type: string;
}

interface YaoFile {
  name: string;
  tempFile: string;
  size: number;
  header: {
    [key: string]: object;
    mimeType: {
      "Content-Disposition": string[];
      "Content-Type": string[];
    };
  };
}