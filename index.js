#!/usr/bin/env node

import { program } from "commander";
import inquirer from "inquirer";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

// กำหนดพาธสำหรับไฟล์เก็บ config
const CONFIG_PATH = path.join(os.homedir(), ".git-profiles.json");

// อ่านข้อมูล profiles จากไฟล์
async function loadProfiles() {
	try {
		const data = await fs.readFile(CONFIG_PATH, "utf8");
		return JSON.parse(data);
	} catch (error) {
		return [];
	}
}

// บันทึกข้อมูล profiles ลงไฟล์
async function saveProfiles(profiles) {
	await fs.writeFile(CONFIG_PATH, JSON.stringify(profiles, null, 2));
}

// เพิ่ม profile ใหม่
async function addProfile() {
	const answers = await inquirer.prompt([
		{
			type: "input",
			name: "name",
			message: "Enter profile name:",
		},
		{
			type: "input",
			name: "username",
			message: "Enter Git username:",
		},
		{
			type: "input",
			name: "email",
			message: "Enter Git email:",
		},
	]);

	const profiles = await loadProfiles();
	profiles.push(answers);
	await saveProfiles(profiles);
	console.log("Profile added successfully!");
}

// แสดงรายการ profiles ทั้งหมด
async function listProfiles() {
	const profiles = await loadProfiles();
	if (profiles.length === 0) {
		console.log("No profiles found.");
		return;
	}

	console.log("\nAvailable profiles:");
	profiles.forEach((profile, index) => {
		console.log(`${index + 1}. ${profile.name} (${profile.username}, ${profile.email})`);
	});
}

// ลบ profile
async function removeProfile() {
	const profiles = await loadProfiles();
	if (profiles.length === 0) {
		console.log("No profiles found to remove.");
		return;
	}

	// เพิ่มตัวเลือก Cancel ในรายการ
	const choices = [
		...profiles.map((p, index) => ({
			name: `${p.name} (${p.username}, ${p.email})`,
			value: index,
		})),
		{ name: "Cancel", value: -1 }, // เพิ่มตัวเลือกยกเลิก
	];

	const { profileToRemove } = await inquirer.prompt([
		{
			type: "list",
			name: "profileToRemove",
			message: "Select a profile to remove (or Cancel to exit):",
			choices: choices,
		},
	]);

	// ถ้าเลือก Cancel
	if (profileToRemove === -1) {
		console.log("Operation cancelled.");
		return;
	}

	const { confirm } = await inquirer.prompt([
		{
			type: "confirm",
			name: "confirm",
			message: `Are you sure you want to remove "${profiles[profileToRemove].name}"?`,
			default: false,
		},
	]);

	if (confirm) {
		profiles.splice(profileToRemove, 1);
		await saveProfiles(profiles);
		console.log("Profile removed successfully!");
	} else {
		console.log("Profile removal cancelled.");
	}
}

// สลับไปใช้ profile ที่เลือก
async function switchProfile() {
	const profiles = await loadProfiles();
	if (profiles.length === 0) {
		console.log("No profiles found. Please add a profile first.");
		return;
	}

	// เพิ่มตัวเลือก Cancel ในรายการ
	const choices = [
		...profiles.map((p, index) => ({
			name: `${p.name} (${p.username}, ${p.email})`,
			value: p,
		})),
		{ name: "Cancel", value: -1 }, // เพิ่มตัวเลือกยกเลิก
	];

	const { profile } = await inquirer.prompt([
		{
			type: "list",
			name: "profile",
			message: "Select a profile to switch to:",
			choices: choices,
		},
	]);

	// ถ้าเลือก Cancel
	if (profile === -1) {
		console.log("Operation cancelled.");
		return;
	}

	try {
		await execAsync(`git config --global user.name "${profile.username}"`);
		await execAsync(`git config --global user.email "${profile.email}"`);
		console.log(`Switched to profile: ${profile.name}`);
	} catch (error) {
		console.error("Error switching profile:", error.message);
	}
}

// แสดง profile ที่ใช้งานอยู่
async function showCurrent() {
	try {
		const { stdout: name } = await execAsync("git config --global user.name");
		const { stdout: email } = await execAsync("git config --global user.email");
		console.log("\nCurrent Git configuration:");
		console.log(`Username: ${name.trim()}`);
		console.log(`Email: ${email.trim()}`);
	} catch (error) {
		console.error("Error getting current configuration:", error.message);
	}
}

// สร้าง CLI commands
program.version("1.0.0").description("Git profile switcher");

program.command("add").description("Add a new Git profile").action(addProfile);

program.command("remove").aliases(["rm", "r"]).description("Remove a Git profile").action(removeProfile);

program.command("list").aliases(["l", "ls", "lst"]).description("List all Git profiles").action(listProfiles);

program.command("switch").aliases(["sw", "s"]).description("Switch Git profile").action(switchProfile);

program.command("current").alias("c").description("Show current Git configuration").action(showCurrent);

program.parse(process.argv);

