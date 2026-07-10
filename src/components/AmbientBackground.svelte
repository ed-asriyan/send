<div class="fixed inset-0 z-0 pointer-events-none overflow-hidden">
    <div class="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-300/40 rounded-full mix-blend-multiply filter blur-[100px] animate-[blob_15s_infinite]"></div>
    <div class="absolute top-[20%] right-[-10%] w-[600px] h-[600px] bg-blue-300/40 rounded-full mix-blend-multiply filter blur-[120px] animate-[blob_15s_infinite] animation-delay-2000"></div>
    <div class="absolute bottom-[-20%] left-[20%] w-[700px] h-[700px] bg-sky-200/40 rounded-full mix-blend-multiply filter blur-[130px] animate-[blob_15s_infinite] animation-delay-4000"></div>
</div>

<style>
    @keyframes blob {
        0% { transform: translate(0px, 0px) scale(1); }
        33% { transform: translate(30px, -50px) scale(1.1); }
        66% { transform: translate(-20px, 20px) scale(0.9); }
        100% { transform: translate(0px, 0px) scale(1); }
    }
</style>