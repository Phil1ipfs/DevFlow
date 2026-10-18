using System.Reflection;
using DevFlow.Api.Controllers;
using Microsoft.AspNetCore.Mvc.Controllers;

namespace DevFlow.Api.Common;

/// <summary>Removes development-only controllers so their routes are never mapped in Production.</summary>
internal sealed class DevOnlyControllerFeatureProvider(bool includeDevControllers) : ControllerFeatureProvider
{
    protected override bool IsController(TypeInfo typeInfo) =>
        base.IsController(typeInfo) && (includeDevControllers || typeInfo.AsType() != typeof(DevController));
}
