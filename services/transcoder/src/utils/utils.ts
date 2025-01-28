import path from "path";
import fs, {
  existsSync,
  mkdirSync,
  promises as fsPromises,
  constants,
} from "fs";

export const getAllFiles = (dir: string, fileList: string[] = []): string[] => {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (file.endsWith(".mp4")) {
      fileList.push(filePath);
    }
  });
  return fileList;
};

export const ensureDownloadDirectory = () => {
  const downloadDir = path.resolve(__dirname, "../downloads");
  if (!existsSync(downloadDir)) {
    mkdirSync(downloadDir, { recursive: true });
  }
  return downloadDir;
};

export const deleteDirectoryRecursive = async (dirPath: string) => {
  try {
    try {
      await fsPromises.access(dirPath, constants.F_OK);
    } catch (error) {
      console.log(`Directory not found: ${dirPath}`);
      return;
    }

    const files = await fsPromises.readdir(dirPath);
    for (const file of files) {
      const currentPath = path.join(dirPath, file);
      const stat = await fsPromises.lstat(currentPath);
      if (stat.isDirectory()) {
        await deleteDirectoryRecursive(currentPath);
      } else {
        await fsPromises.unlink(currentPath);
      }
    }

    // Now remove the empty directory
    await fsPromises.rmdir(dirPath);
    console.log(`Deleted directory: ${dirPath}`);
  } catch (error) {
    console.error(`Error deleting directory ${dirPath}:`, error);
  }
};
