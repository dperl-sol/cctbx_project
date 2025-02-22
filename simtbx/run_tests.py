from __future__ import absolute_import, division, print_function
import sys
from libtbx import test_utils
import libtbx.load_env

nb_tst_list = [
    "$D/nanoBragg/tst_nanoBragg_minimal.py",
    "$D/nanoBragg/tst_nanoBragg_mosaic.py",
    "$D/nanoBragg/tst_gaussian_mosaicity.py",
    "$D/nanoBragg/tst_gaussian_mosaicity2.py",
    "$D/nanoBragg/tst_nanoBragg_cbf_write.py",
    "$D/nanoBragg/tst_multisource_background.py",
    "$D/nanoBragg/tst_anisotropic_mosaicity.py"]

db_tst_list_nonCuda = ["$D/diffBragg/tests/tst_diffBragg_utils.py",
                       "$D/diffBragg/tests/tst_diffBragg_structure_factors.py"]
db_tst_list_onlyCuda =[["$D/diffBragg/tests/tst_diffBragg_hopper_refine.py", "--perturb eta --cuda"]]

db_tst_list = [
    "$D/diffBragg/tests/tst_diffBragg_Fhkl_complex.py",
    "$D/diffBragg/tests/tst_diffBragg_change_of_basis.py",
    "$D/diffBragg/tests/tst_diffBragg_update_dxtbx_geoms.py",
    "$D/diffBragg/tests/tst_diffBragg_deriv_rois.py",
    "$D/diffBragg/tests/tst_diffBragg_detdist_derivatives.py",
    "$D/diffBragg/tests/tst_diffBragg_nanoBragg_congruency.py",
    "$D/diffBragg/tests/tst_diffBragg_ncells_property.py",
    "$D/diffBragg/tests/tst_diffBragg_ncells_offdiag_property.py",
    ["$D/diffBragg/tests/tst_diffBragg_ncells_offdiag_property.py", "--idx 1"],
    ["$D/diffBragg/tests/tst_diffBragg_ncells_offdiag_property.py", "--idx 2"],
    ["$D/diffBragg/tests/tst_diffBragg_ncells_property_anisotropic.py", "--idx 0"],
    ["$D/diffBragg/tests/tst_diffBragg_ncells_property_anisotropic.py", "--idx 1"],
    ["$D/diffBragg/tests/tst_diffBragg_ncells_property_anisotropic.py", "--idx 2"],
    ["$D/diffBragg/tests/tst_diffBragg_lambda_coefficients.py", "--idx 0"],
    ["$D/diffBragg/tests/tst_diffBragg_lambda_coefficients.py", "--idx 1"],
    "$D/diffBragg/tests/tst_diffBragg_regions_of_interest.py",
    "$D/diffBragg/tests/tst_diffBragg_rotXYZ.py",
    ["$D/diffBragg/tests/tst_diffBragg_rotXYZ_deriv.py", "--curvatures --rotidx 0"],
    ["$D/diffBragg/tests/tst_diffBragg_rotXYZ_deriv.py", "--curvatures --rotidx 1"],
    ["$D/diffBragg/tests/tst_diffBragg_rotXYZ_deriv.py", "--curvatures --rotidx 2"],
    ["$D/diffBragg/tests/tst_diffBragg_hopper_refine.py", "--perturb crystal"],
    ["$D/diffBragg/tests/tst_diffBragg_hopper_refine.py", "--perturb Nabc"],
    ["$D/diffBragg/tests/tst_diffBragg_hopper_refine.py", "--perturb G"],
    ["$D/diffBragg/tests/tst_diffBragg_hopper_refine.py", "--perturb detz_shift"],
    ["$D/diffBragg/tests/tst_diffBragg_hopper_refine.py", "--perturb crystal Nabc G"],
    ["$D/diffBragg/tests/tst_diffBragg_hopper_refine.py", "--perturb crystal Nabc G detz_shift"],
    ["$D/diffBragg/tests/tst_diffBragg_hopper_refine.py", "--perturb Nabc G"],
    ["$D/diffBragg/tests/tst_diffBragg_Fcell_deriv.py", "--curvatures"],
    ["$D/diffBragg/tests/tst_diffBragg_eta_derivs.py", "--curvatures"],
    "$D/diffBragg/tests/tst_diffBragg_eta_derivs.py",
    ["$D/diffBragg/tests/tst_diffBragg_eta_derivs.py", "--aniso 0"],
    ["$D/diffBragg/tests/tst_diffBragg_eta_derivs.py", "--aniso 1"],
    ["$D/diffBragg/tests/tst_diffBragg_eta_derivs.py", "--aniso 2"],
    ["$D/diffBragg/tests/tst_diffBragg_panelXY_derivs.py", "--panel x"],
    ["$D/diffBragg/tests/tst_diffBragg_panelXY_derivs.py", "--panel y"],
    ["$D/diffBragg/tests/tst_diffBragg_panelXY_derivs.py", "--panel z"],
    ["$D/diffBragg/tests/tst_diffBragg_diffuse_properties.py", "--idx 0 --gamma 100 125 150"],
    ["$D/diffBragg/tests/tst_diffBragg_diffuse_properties.py", "--idx 1 --gamma 100 125 150"],
    ["$D/diffBragg/tests/tst_diffBragg_diffuse_properties.py", "--idx 2 --gamma 100 125 150"],
    ["$D/diffBragg/tests/tst_diffBragg_diffuse_properties.py", "--idx 0 --gamma 100 125 150 --grad sigma --sigma 1 2 3"],
    ["$D/diffBragg/tests/tst_diffBragg_diffuse_properties.py", "--idx 1 --gamma 100 125 150 --grad sigma --sigma 1 2 3"],
    ["$D/diffBragg/tests/tst_diffBragg_diffuse_properties.py", "--idx 2 --gamma 100 125 150 --grad sigma --sigma 1 2 3"]
    ]

OPT = libtbx.env.build_options

tst_list = nb_tst_list
if OPT.enable_cxx11 and sys.platform != 'win32':
    tst_list += db_tst_list+db_tst_list_nonCuda

if OPT.enable_cuda:
  tst_list_parallel = [
    ["$D/nanoBragg/tst_gauss_argchk.py","GPU"], # tests CPU+GPU, argchk optimization
    "$D/gpu/tst_exafel_api.py",                 # CPU / GPU, polychromatic beam, monolithic detector
    "$D/gpu/tst_gpu_multisource_background.py", # CPU / GPU background comparison
    "$D/kokkos/tst_kokkos_lib.py",              # GPU in kokkos
  ]
  if not OPT.enable_kokkos:
    tst_list_parallel.pop(-1)    # remove kokkos test if kokkos is not available
  if OPT.enable_cxx11 and sys.platform != 'win32':
      for tst in db_tst_list:
          if isinstance(tst, str):
              par_tst = [tst, "--cuda"]
          else:
              par_tst = tst + ["--cuda"]
          tst_list_parallel.append(par_tst)

      tst_list_parallel += db_tst_list_onlyCuda
elif OPT.enable_kokkos:
   tst_list_parallel = [
     ["$D/nanoBragg/tst_gauss_argchk.py","CPU"], # tests CPU argchk optimization
     "$D/kokkos/tst_kokkos_lib.py",              # GPU in kokkos
   ]
else:
  tst_list.append(
    ["$D/nanoBragg/tst_gauss_argchk.py","CPU"]
  )

def run():
  build_dir = libtbx.env.under_build("simtbx")
  dist_dir = libtbx.env.dist_path("simtbx")
  test_utils.run_tests(build_dir, dist_dir, tst_list)

if (__name__ == "__main__"):
  run()
