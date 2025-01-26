import path from "path";
import fs, {
  existsSync,
  mkdirSync,
  promises as fsPromises,
  constants,
} from "fs";

export const getAllFiles = (dirPath: string): string[] => {
  const files: string[] = [];
  fs.readdirSync(dirPath).forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.lstatSync(filePath).isDirectory()) {
      files.push(...getAllFiles(filePath));
    } else {
      files.push(filePath);
    }
  });
  return files;
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
