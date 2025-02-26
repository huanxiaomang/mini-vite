export const hmrClientScript = (port: number) => `
    <script type="module">
      const ws = new WebSocket('ws://localhost:${port}');
      ws.onmessage = ({ data }) => {
        const payload = JSON.parse(data);
        if (payload.type === 'update') {
          import(\`\${payload.path}?t=\${Date.now()}\`).then(() => {
            console.log('HMR: Updated ' + payload.path);
          });
        } else if (payload.type === 'full-reload') {
          window.location.reload();
        }
      };
    </script>
  `;
