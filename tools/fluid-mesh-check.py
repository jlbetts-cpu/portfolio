from pathlib import Path

lab = Path("gradientlab.html").read_text(encoding="utf-8")
runtime = Path("fluid-mesh.js").read_text(encoding="utf-8")

assert '<script src="fluid-mesh.js"></script>' in lab
assert "function FluidMesh(canvas,cfg)" not in lab
assert "function FluidMesh(canvas,cfg)" in runtime
for method in ("set:", "pause:", "resume:", "renderOnce:", "destroy:", "snapshot:"):
    assert method in runtime, method
assert "window.FluidMesh=FluidMesh" in runtime
assert 'if(!gl){abort(new Error("WebGL context unavailable"));return null;}' in runtime
assert 'if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error("WebGL program link failed: "+gl.getProgramInfoLog(prog));' in runtime
print("fluid mesh extraction: OK")
