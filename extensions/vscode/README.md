<div align="center">

<!-- Replace with your own logo -->
![DebuggAI logo](https://static-debugg-ai.s3.us-east-2.amazonaws.com/extension/media/header-comm.png)

</div>

<h1 align="center">DebuggAI</h1>

<div align="center">

[DebuggAI](https://debugg.ai) is a Zero-Config, Fully AI-Managed End-to-End Testing platform that allows engineers to focus on the features, not the tests. Our AI agents test UI changes, simulate user behavior, and analyze visual outputs of running web applications — all via natural language and CLI tools. 



</div>

<div align="center">

<a href="https://opensource.org/licenses/Apache-2.0" target="_blank">
  <img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" height="22" />
</a>
<a href="https://docs.debugg.ai" target="_blank">
  <img src="https://img.shields.io/badge/docs-debuggai-%235D0E41" height="22" />
</a>
<a href="https://marketplace.visualstudio.com/items?itemName=debugg-ai.debugg-ai" target="_blank">
  <img src="https://img.shields.io/visual-studio-marketplace/v/debugg-ai.debugg-ai?color=007ACC&label=VS Code" height="22" />
</a>
<!-- <a href="https://plugins.jetbrains.com/plugin/22707-debuggai" target="_blank">
  <img src="https://img.shields.io/badge/jetbrains-install-%236F6FF7?logo=jetbrains" height="22" />
</a> -->
<a href="https://discord.gg/65SFr8yJU2" target="_blank">
  <img src="https://img.shields.io/badge/discord-join-debuggai.svg?labelColor=191937&color=6F6FF7&logo=discord" height="22" />
</a>

</div>

---

## ✨ Why DebuggAI?

Most AI coding tools focus on **writing** code.  
DebuggAI focuses on the other 50 % of an engineer’s life: **getting it to run.**

* **Zero, and we mean Zero Config** - When you're early in a product's life, you don't want to deal with setting up test pipelines, managing test dbs, environments and so on just so they can change the next week (we certainly didn't). Our tests securely tunnel into the IDE and then browse your app using localhost:3000, for example, so there's literally no additional setup.
* **Text based End-to-end Tests** - No more xpath nightmares, simply enter a test request like "test the login flow" and let it go.
* **In IDE Test Reports** - Our e2e tests output results directly in the IDE Test Results panel so you can quickly see what's working and what's not. 
* **Automated test repair** - Our agents not only rerun previous tests but can reconize the difference between a purposeful change of button positioning and a broken workflow.
* **Remote browsers by default** - We handle all the browser management and controllers remotely to keep your enviroment uncluttered and focused. 


---

## 📺 Demo - Get Instant Insight Into Real, Functional Issues


### 🔍 Typical workflows:

1. You use your favorite AI agent to write code
2. You run your app and it crashes (ah whyyyyy!)
3. DebuggAI runs tests to evaluate the changes and provides a full report
4. You review the solution, edit it locally if needed, and apply it

### 🔍 How it works

<div align="center"><img src="https://static-debugg-ai.s3.us-east-2.amazonaws.com/sample-account-creation-flow.gif"/></div>

---

## 🖥️ Core IDE Features

| Feature | Description | Demo |
|---------|-------------|------|
| **Text Based Test Requests** | Quickly configure and run new tests on app features using simple english. 'Test my login flow' | ![Easy E2Es](https://static-debugg-ai.s3.us-east-2.amazonaws.com/extension/recordings/text-based-test-design.gif) |
| **Test Results Suite** | Get sequential and final results directly in Test Results panel | ![Test Results](https://static-debugg-ai.s3.us-east-2.amazonaws.com/extension/recordings/error-in-test-creation.gif) |
| **Easy Test Tracking** | Use our web app to view previous runs, rerun others, and more! | ![tracking](https://static-debugg-ai.s3.us-east-2.amazonaws.com/extension/recordings/view-e2e-tests-in-web-app.gif) |
| **Secure Local Tunnels** | Our testers connect directly to your localhost servers to reduce overhead | ![tunnels](https://static-debugg-ai.s3.us-east-2.amazonaws.com/extension/recordings/tunnel-to-local.gif) |
| **Recording Gif Creation** | Simplify debugging and test review with in IDE recordings after each test | ![actions](https://static-debugg-ai.s3.us-east-2.amazonaws.com/extension/recordings/gif-recording-creation.gif) |



---


## 🚀 Getting Started

1. **Install the extension**  
   - [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=debugg-ai.debuggai)  
   - Jetbrains coming soon

2. **Login** 
   – You can login to your DebuggAI account directly in the extension and then it will automatically connect to your project. ⚡
        <div align=""><img src="https://static-debugg-ai.s3.us-east-2.amazonaws.com/extension/media/debugg-ai-signin-big.png" alt="Login config" width="300"/></div>

3. **Start a test**
   - Use `⌘ ⇧ P` to open command list and find Debugg AI: Create New E2e Test. Or use the shortcut, `⌘ ⌥ C` (cmd + alt + c).


        <div align=""><img src="https://static-debugg-ai.s3.us-east-2.amazonaws.com/extension/media/new-e2e-test.png" alt="end to end test creation" width="300"/></div>
   - A new popup will appear to ask for a decsription and once submitted will begin running immediately. 



Full walkthrough ▶ [docs.debugg.ai/getting-started](https://docs.debugg.ai)

---

## 🛠️ Configuration

We default to assuming your app server is running on `localhost:3000`. If you would like to configure a different port, or have 2 apps running at the same time, you need to update the `Local Server Port` in the settings tab of the Debugg AI extension.

Simply open the Extension, click the `gear` icon and update the value located in the `Testing Configuration` section.


---

## 🤝  Interested in Contributing?

We're looking to expand the DebuggAI team! 

If you're interested in joining the team or contributing to the project, please reach out to us at [hello@debugg.ai](mailto:hello@debugg.ai).

---

## 📜 License & Credits

- **Code:** [Apache 2.0](LICENSE) © 2025 Debugg, Inc.  
- **Foundation:** proudly built on [Continue](https://github.com/continuedev/continue)

---

## Attribution

We at Debugg AI would like to thank the Continue team for their work on this extension. Their extensive code base provided an excellent starting point for this extension. You can find the original repository [here](https://github.com/continuedev/continue). 

Debugg AI aims to give local AI coding agents more context and awareness of runtime events through system wide application monitoring and as such is not focused on developing the extensive feature set of Continue. If you are looking for a great tool for developers to create, share, and use custom AI code assistants, we recommend checking out Continue.  

A copy of the original license is included in this repository for your convenience. We have used best efforts to ensure that the original license is respected. If you have any questions, please contact us at support@debugg.ai.


## Original License

[Apache 2.0 © 2023-2024 Continue Dev, Inc.](./LICENSE)


<div align="center">
  <sub>Made with 🩸, 💦, and 😭 in San Francisco.</sub>
</div>

